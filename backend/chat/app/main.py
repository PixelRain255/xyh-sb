import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

PROJECT_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_DIR / "static"

# 优先读取 backend/chat/.env（覆盖系统同名环境变量，避免读到旧值）
load_dotenv(dotenv_path=PROJECT_DIR / ".env", override=True)
# 兼容从工作目录加载 .env（不覆盖上面已加载的值）
load_dotenv(override=False)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="Minimal FastAPI AI Chat Backend")
logger = logging.getLogger(__name__)


def build_chat_completions_url(base_url: str) -> str:
    """兼容不同写法的 OPENAI_BASE_URL。"""
    cleaned = base_url.strip().rstrip("/")
    if cleaned.endswith("/chat/completions"):
        return cleaned
    if cleaned.endswith("/v1"):
        return f"{cleaned}/chat/completions"
    return f"{cleaned}/v1/chat/completions"


def build_models_url(base_url: str) -> str:
    """构建 models 接口地址，用于连通性和模型可用性检查。"""
    cleaned = base_url.strip().rstrip("/")
    if cleaned.endswith("/models"):
        return cleaned
    if cleaned.endswith("/chat/completions"):
        return f"{cleaned.rsplit('/chat/completions', 1)[0]}/models"
    if cleaned.endswith("/v1"):
        return f"{cleaned}/models"
    return f"{cleaned}/v1/models"


def build_responses_url(base_url: str) -> str:
    """构建 responses 接口地址（兼容 Codex/Responses 风格模型）。"""
    cleaned = base_url.strip().rstrip("/")
    if cleaned.endswith("/responses"):
        return cleaned
    if cleaned.endswith("/chat/completions"):
        return f"{cleaned.rsplit('/chat/completions', 1)[0]}/responses"
    if cleaned.endswith("/v1"):
        return f"{cleaned}/responses"
    return f"{cleaned}/v1/responses"


def infer_error_code(status_code: int, body: str = "") -> str:
    text = (body or "").lower()
    if status_code == 401:
        return "INVALID_API_KEY"
    if status_code == 403:
        return "FORBIDDEN"
    if status_code == 404:
        return "NOT_FOUND"
    if status_code == 429:
        return "RATE_LIMITED"
    if status_code >= 500:
        return "UPSTREAM_SERVER_ERROR"
    if "api key" in text and "invalid" in text:
        return "INVALID_API_KEY"
    return "UPSTREAM_ERROR"


def infer_chat_error_code(status_code: int, body: str = "") -> str:
    text = (body or "").lower()
    if "not supported" in text and "model" in text:
        return "MODEL_NOT_SUPPORTED"
    if "chatgpt account" in text and "codex" in text:
        return "MODEL_NOT_SUPPORTED"
    return infer_error_code(status_code, body)


def format_upstream_error(status_code: int, body: str, is_chat: bool = False) -> str:
    error_code = infer_chat_error_code(status_code, body) if is_chat else infer_error_code(status_code, body)
    return f"{error_code}: Upstream model API error: {status_code}, body: {body}"


def should_use_responses_api(model: str) -> bool:
    flag = os.getenv("OPENAI_USE_RESPONSES_API", "").strip().lower()
    if flag in {"1", "true", "yes", "on"}:
        return True
    return "codex" in model.lower()


def parse_fallback_models(primary_model: str) -> List[str]:
    raw = os.getenv("OPENAI_FALLBACK_MODEL", "")
    candidates = [m.strip() for m in raw.split(",") if m.strip()]
    return [m for m in candidates if m != primary_model]


def get_empty_reply_fallback() -> str:
    text = os.getenv("OPENAI_EMPTY_REPLY_FALLBACK", "").strip()
    return text or "（模型已响应，但未返回可展示文本）"


def truncate_text(text: str, max_len: int = 400) -> str:
    raw = text or ""
    return raw if len(raw) <= max_len else raw[:max_len] + "...(truncated)"


def extract_stream_chunk_text(event: Dict[str, Any]) -> str:
    """从流式事件中提取增量文本。"""
    # Chat Completions stream 常见格式: choices[0].delta.content
    try:
        delta = event["choices"][0].get("delta")
        if isinstance(delta, dict):
            content = delta.get("content")
            if isinstance(content, str) and content:
                return content
    except (KeyError, IndexError, TypeError, AttributeError):
        pass

    # 某些兼容网关: choices[0].text
    try:
        text = event["choices"][0].get("text")
        if isinstance(text, str) and text:
            return text
    except (KeyError, IndexError, TypeError, AttributeError):
        pass

    # Responses API 事件：response.output_text.delta
    event_type = event.get("type")
    if event_type in {"response.output_text.delta", "output_text.delta"}:
        delta = event.get("delta")
        if isinstance(delta, str) and delta:
            return delta

    # 某些实现直接在事件里给 output_text
    output_text = event.get("output_text")
    if isinstance(output_text, str) and output_text:
        return output_text

    return ""


async def collect_reply_via_stream(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
) -> Optional[str]:
    """对上游发起 stream 请求并聚合文本。"""
    stream_payload = dict(payload)
    stream_payload["stream"] = True

    chunks: List[str] = []
    try:
        async with client.stream("POST", url, headers=headers, json=stream_payload) as stream_resp:
            if stream_resp.status_code != 200:
                body = await stream_resp.aread()
                logger.warning(
                    "[/chat] stream request failed | status=%s | body=%s",
                    stream_resp.status_code,
                    truncate_text(body.decode("utf-8", errors="ignore")),
                )
                return None

            async for raw_line in stream_resp.aiter_lines():
                line = (raw_line or "").strip()
                if not line:
                    continue

                # SSE 标准: data: {...}
                if line.startswith("data:"):
                    line = line[5:].strip()

                if line == "[DONE]":
                    break

                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                piece = extract_stream_chunk_text(event)
                if piece:
                    chunks.append(piece)

        reply = "".join(chunks).strip()
        return reply or None

    except Exception:
        logger.exception("[/chat] collect stream reply failed")
        return None


def extract_reply_text(data: Dict[str, Any]) -> str:
    """兼容不同上游返回格式，尽量提取文本回复。"""
    # OpenAI Chat Completions 常见格式
    try:
        content = data["choices"][0]["message"].get("content")
        if isinstance(content, str) and content.strip():
            return content
    except (KeyError, IndexError, TypeError, AttributeError):
        pass

    # 某些兼容网关会把文本放在 choices[0].text
    try:
        text = data["choices"][0].get("text")
        if isinstance(text, str) and text.strip():
            return text
    except (KeyError, IndexError, TypeError, AttributeError):
        pass

    # Responses API 风格（部分网关透传）
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    # Responses API 标准 output 结构
    output = data.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue

            item_text = item.get("text")
            if isinstance(item_text, str) and item_text.strip():
                return item_text

            content = item.get("content")
            if isinstance(content, list):
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    part_text = part.get("text") or part.get("output_text")
                    if isinstance(part_text, str) and part_text.strip():
                        return part_text

    raise ValueError("No textual reply found in upstream response")


# 最基础 CORS 配置，方便前端联调
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    """最基础健康检查（不访问上游模型）。"""
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    return {
        "ok": True,
        "service": "backend-chat",
        "env": {
            "has_api_key": bool(api_key),
            "has_base_url": bool(base_url),
            "model": model,
        },
    }


@app.get("/model/check")
async def model_check():
    """给前端页面用的最小模型检查接口。"""
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

    if not api_key or not base_url:
        return {
            "ok": False,
            "error_code": "MISSING_ENV",
            "message": "Missing OPENAI_API_KEY or OPENAI_BASE_URL",
            "model": model,
        }

    models_url = build_models_url(base_url)
    chat_url = build_chat_completions_url(base_url)
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        timeout = httpx.Timeout(20.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(models_url, headers=headers)

        if resp.status_code != 200:
            return {
                "ok": False,
                "error_code": infer_error_code(resp.status_code, resp.text),
                "message": f"Models API error: {resp.status_code}",
                "details": resp.text,
                "model": model,
                "models_url": models_url,
                "chat_url": chat_url,
            }

        data = resp.json()
        model_ids = [item.get("id") for item in data.get("data", []) if isinstance(item, dict)]
        model_found = model in model_ids if model_ids else None

        return {
            "ok": True,
            "error_code": None,
            "message": "Model API reachable",
            "model": model,
            "model_found": model_found,
            "models_count": len(model_ids),
            "models_url": models_url,
            "chat_url": chat_url,
        }

    except httpx.TimeoutException:
        return {
            "ok": False,
            "error_code": "UPSTREAM_TIMEOUT",
            "message": "Models API request timed out",
            "model": model,
            "models_url": models_url,
            "chat_url": chat_url,
        }
    except httpx.RequestError as e:
        return {
            "ok": False,
            "error_code": "UPSTREAM_REQUEST_FAILED",
            "message": f"Failed to call Models API: {str(e)}",
            "model": model,
            "models_url": models_url,
            "chat_url": chat_url,
        }


@app.get("/health/ready")
async def health_ready():
    """就绪检查：会访问上游 models 接口。"""
    result = await model_check()
    return {
        "ok": bool(result.get("ok")),
        "error_code": result.get("error_code"),
        "message": result.get("message"),
        "model": result.get("model"),
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

    if not api_key or not base_url:
        raise HTTPException(
            status_code=500,
            detail="Missing OPENAI_API_KEY or OPENAI_BASE_URL in environment variables.",
        )

    chat_url = build_chat_completions_url(base_url)
    responses_url = build_responses_url(base_url)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    model_candidates = [model, *parse_fallback_models(model)]
    logger.info(
        "[/chat] incoming request | model=%s | candidates=%s | msg_len=%s",
        model,
        model_candidates,
        len(req.message or ""),
    )

    try:
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = None
            active_model = model_candidates[0]
            used_chat_api = True

            for candidate in model_candidates:
                active_model = candidate
                use_responses_api = should_use_responses_api(active_model)

                chat_payload: Dict[str, Any] = {
                    "model": active_model,
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": req.message},
                    ],
                    "temperature": 0.7,
                }
                responses_payload: Dict[str, Any] = {
                    "model": active_model,
                    "input": [
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": req.message},
                    ],
                    "temperature": 0.7,
                }

                if use_responses_api:
                    logger.info("[/chat] try responses API | model=%s | url=%s", active_model, responses_url)
                    resp = await client.post(responses_url, headers=headers, json=responses_payload)
                    used_chat_api = False
                    logger.info(
                        "[/chat] responses result | model=%s | status=%s | body=%s",
                        active_model,
                        resp.status_code,
                        truncate_text(resp.text),
                    )

                    # Responses 不支持时，尝试同模型切换到 Chat Completions
                    if resp.status_code != 200 and infer_chat_error_code(resp.status_code, resp.text) == "MODEL_NOT_SUPPORTED":
                        logger.info("[/chat] responses not supported, fallback to chat-completions | model=%s", active_model)
                        resp = await client.post(chat_url, headers=headers, json=chat_payload)
                        used_chat_api = True
                        logger.info(
                            "[/chat] chat-completions fallback result | model=%s | status=%s | body=%s",
                            active_model,
                            resp.status_code,
                            truncate_text(resp.text),
                        )
                else:
                    logger.info("[/chat] try chat-completions API | model=%s | url=%s", active_model, chat_url)
                    resp = await client.post(chat_url, headers=headers, json=chat_payload)
                    used_chat_api = True
                    logger.info(
                        "[/chat] chat-completions result | model=%s | status=%s | body=%s",
                        active_model,
                        resp.status_code,
                        truncate_text(resp.text),
                    )

                    # Chat Completions 不支持时，尝试同模型切换到 Responses
                    if resp.status_code != 200 and infer_chat_error_code(resp.status_code, resp.text) == "MODEL_NOT_SUPPORTED":
                        logger.info("[/chat] chat-completions not supported, fallback to responses | model=%s", active_model)
                        resp = await client.post(responses_url, headers=headers, json=responses_payload)
                        used_chat_api = False
                        logger.info(
                            "[/chat] responses fallback result | model=%s | status=%s | body=%s",
                            active_model,
                            resp.status_code,
                            truncate_text(resp.text),
                        )

                if resp.status_code == 200:
                    data = resp.json()
                    try:
                        reply = extract_reply_text(data)
                    except ValueError:
                        logger.warning("UPSTREAM_EMPTY_REPLY on non-stream response, trying stream mode. body=%s", resp.text)
                        retry_url = chat_url if used_chat_api else responses_url
                        retry_payload = chat_payload if used_chat_api else responses_payload
                        streamed_reply = await collect_reply_via_stream(client, retry_url, headers, retry_payload)
                        if streamed_reply:
                            reply = streamed_reply
                            logger.info("[/chat] stream retry success | model=%s | api=%s", active_model, "chat" if used_chat_api else "responses")
                        else:
                            logger.warning("UPSTREAM_EMPTY_REPLY, stream retry still empty, returning fallback text")
                            reply = get_empty_reply_fallback()
                    logger.info("[/chat] success | model=%s | api=%s", active_model, "chat" if used_chat_api else "responses")
                    return ChatResponse(reply=reply)

                # 只有模型不支持才继续尝试下一个候选模型
                if infer_chat_error_code(resp.status_code, resp.text) != "MODEL_NOT_SUPPORTED":
                    raise HTTPException(
                        status_code=502,
                        detail=format_upstream_error(resp.status_code, resp.text, is_chat=used_chat_api),
                    )

            # 所有候选模型都不支持
            last_body = resp.text if resp is not None else ""
            raise HTTPException(
                status_code=502,
                detail=(
                    "MODEL_NOT_SUPPORTED: None of the candidate models are supported for chat. "
                    f"Tried: {', '.join(model_candidates)}. Last upstream body: {last_body}"
                ),
            )

    except httpx.TimeoutException:
        logger.exception("[/chat] upstream timeout")
        raise HTTPException(status_code=504, detail="Model API request timed out.")
    except httpx.RequestError as e:
        logger.exception("[/chat] upstream request error")
        raise HTTPException(status_code=502, detail=f"Failed to call model API: {str(e)}")
    except (KeyError, IndexError, TypeError, ValueError):
        body = resp.text if 'resp' in locals() and resp is not None else ""
        raise HTTPException(status_code=502, detail=f"Unexpected model API response: {body}")
    except HTTPException as e:
        logger.warning("[/chat] http exception | status=%s | detail=%s", e.status_code, e.detail)
        raise
    except Exception as e:
        logger.exception("Unhandled /chat exception")
        raise HTTPException(status_code=500, detail=f"CHAT_INTERNAL_ERROR: {type(e).__name__}: {str(e)}")
