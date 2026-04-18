import os
from pathlib import Path
from typing import Any, Dict

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel




PROJECT_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_DIR / "static"

# 优先读取 backend/chat/.env
load_dotenv(dotenv_path=PROJECT_DIR / ".env")
load_dotenv()

app = FastAPI(title="Minimal FastAPI AI Chat Backend")




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

    url = build_chat_completions_url(base_url)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


    payload: Dict[str, Any] = {
        "model": model,

        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": req.message},
        ],
        "temperature": 0.7,
    }

    try:
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Upstream model API error: {resp.status_code}, body: {resp.text}",
            )

        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return ChatResponse(reply=reply)

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Model API request timed out.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to call model API: {str(e)}")
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail=f"Unexpected model API response: {resp.text}")



