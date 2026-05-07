import base64
import json
import logging
import os
from typing import Any, AsyncIterator, Dict, List

import httpx
from fastapi import HTTPException, UploadFile

from .chat_service import (
    FINANCE_SYSTEM_PROMPT,
    build_chat_completions_url,
    build_responses_url,
    collect_reply_via_stream,
    extract_reply_text,
    format_upstream_error,
    get_empty_reply_fallback,
    infer_chat_error_code,
    parse_fallback_models,
    should_use_responses_api,
    sse_pack,
    extract_stream_chunk_text,
    truncate_text,
)

logger = logging.getLogger(__name__)


VISION_SYSTEM_PROMPT = (
    FINANCE_SYSTEM_PROMPT
    + "\n\n你现在还支持图像识别。若用户上传财报截图/表格图片，请先提取文字，再给出结构化摘要。"
)


def _validate_image_data_url(image_data_url: str) -> None:
    if not image_data_url or not image_data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="imageDataUrl must be a valid data:image/*;base64,... string")

    max_len = int(os.getenv("VISION_MAX_DATA_URL_LEN", "7000000"))
    if len(image_data_url) > max_len:
        raise HTTPException(status_code=413, detail=f"image too large: data url length exceeds {max_len}")


def _build_responses_payload(active_model: str, message: str, image_data_url: str) -> Dict[str, Any]:
    return {
        "model": active_model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": VISION_SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": message},
                    {"type": "input_image", "image_url": image_data_url},
                ],
            },
        ],
        "temperature": 0.2,
    }


def _build_chat_payload(active_model: str, message: str, image_data_url: str) -> Dict[str, Any]:
    return {
        "model": active_model,
        "messages": [
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": message},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
        "temperature": 0.2,
    }


def _guess_image_mime(upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower().strip()
    if content_type.startswith("image/"):
        return content_type

    filename = (upload.filename or "").lower()
    if filename.endswith(".png"):
        return "image/png"
    if filename.endswith(".jpg") or filename.endswith(".jpeg"):
        return "image/jpeg"
    if filename.endswith(".webp"):
        return "image/webp"
    if filename.endswith(".gif"):
        return "image/gif"
    return "image/png"


def _bytes_to_data_url(raw_bytes: bytes, mime: str) -> str:
    encoded = base64.b64encode(raw_bytes).decode("ascii")
    return f"data:{mime};base64,{encoded}"


async def vision_analyze_once(message: str, image_data_url: str) -> str:
    _validate_image_data_url(image_data_url)

    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key or not base_url:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY or OPENAI_BASE_URL in environment variables.")

    chat_url = build_chat_completions_url(base_url)
    responses_url = build_responses_url(base_url)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    model_candidates: List[str] = [model, *parse_fallback_models(model)]
    resp = None

    timeout = httpx.Timeout(120.0, connect=20.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            for active_model in model_candidates:
                use_responses = should_use_responses_api(active_model)
                responses_payload = _build_responses_payload(active_model, message, image_data_url)
                chat_payload = _build_chat_payload(active_model, message, image_data_url)

                attempts = (
                    [(responses_url, responses_payload, False, "responses"), (chat_url, chat_payload, True, "chat")]
                    if use_responses
                    else [(chat_url, chat_payload, True, "chat"), (responses_url, responses_payload, False, "responses")]
                )

                for url, payload, used_chat_api, api_name in attempts:
                    logger.info("[/vision/analyze] try %s API | model=%s | url=%s", api_name, active_model, url)
                    resp = await client.post(url, headers=headers, json=payload)
                    logger.info(
                        "[/vision/analyze] result | model=%s | api=%s | status=%s | body=%s",
                        active_model,
                        api_name,
                        resp.status_code,
                        truncate_text(resp.text),
                    )

                    if resp.status_code == 200:
                        data = resp.json()
                        try:
                            return extract_reply_text(data)
                        except ValueError:
                            logger.warning(
                                "[/vision/analyze] empty reply on non-stream response, retrying stream | model=%s | api=%s",
                                active_model,
                                api_name,
                            )
                            retry_url = chat_url if used_chat_api else responses_url
                            streamed_reply = await collect_reply_via_stream(client, retry_url, headers, payload)
                            if streamed_reply:
                                logger.info(
                                    "[/vision/analyze] stream retry success | model=%s | api=%s",
                                    active_model,
                                    api_name,
                                )
                                return streamed_reply
                            logger.warning("[/vision/analyze] stream retry still empty, returning fallback text")
                            return get_empty_reply_fallback()

                    if infer_chat_error_code(resp.status_code, resp.text) == "MODEL_NOT_SUPPORTED":
                        continue

                    raise HTTPException(
                        status_code=502,
                        detail=format_upstream_error(resp.status_code, resp.text, is_chat=used_chat_api),
                    )

        last_body = resp.text if resp is not None else ""
        raise HTTPException(
            status_code=502,
            detail=(
                "MODEL_NOT_SUPPORTED: None of the candidate models are supported for vision. "
                f"Tried: {', '.join(model_candidates)}. Last upstream body: {last_body}"
            ),
        )

    except httpx.TimeoutException:
        logger.exception("[/vision/analyze] upstream timeout")
        raise HTTPException(status_code=504, detail="Model API request timed out.")
    except httpx.RequestError as e:
        logger.exception("[/vision/analyze] upstream request error")
        raise HTTPException(status_code=502, detail=f"Failed to call model API: {str(e)}")


async def vision_analyze_upload(message: str, image: UploadFile) -> str:
    if image is None:
        raise HTTPException(status_code=400, detail="image file is required")

    raw_bytes = await image.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="image file is empty")

    max_bytes = int(os.getenv("VISION_MAX_UPLOAD_BYTES", "5242880"))
    if len(raw_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail=f"image too large: upload bytes exceeds {max_bytes}")

    mime = _guess_image_mime(image)
    image_data_url = _bytes_to_data_url(raw_bytes, mime)
    return await vision_analyze_once(message=message, image_data_url=image_data_url)


async def vision_stream_events(message: str, raw_bytes: bytes, mime: str) -> AsyncIterator[str]:
    if not raw_bytes:
        yield sse_pack({"type": "error", "message": "image file is empty"})
        return

    max_bytes = int(os.getenv("VISION_MAX_UPLOAD_BYTES", "5242880"))
    if len(raw_bytes) > max_bytes:
        yield sse_pack({"type": "error", "message": f"image too large: upload bytes exceeds {max_bytes}"})
        return

    image_data_url = _bytes_to_data_url(raw_bytes, mime)
    _validate_image_data_url(image_data_url)

    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key or not base_url:
        yield sse_pack({"type": "error", "message": "Missing OPENAI_API_KEY or OPENAI_BASE_URL in environment variables."})
        return

    chat_url = build_chat_completions_url(base_url)
    responses_url = build_responses_url(base_url)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    model_candidates: List[str] = [model, *parse_fallback_models(model)]
    timeout = httpx.Timeout(120.0, connect=20.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            for active_model in model_candidates:
                use_responses = should_use_responses_api(active_model)
                responses_payload = _build_responses_payload(active_model, message, image_data_url)
                chat_payload = _build_chat_payload(active_model, message, image_data_url)

                attempts = (
                    [(responses_url, responses_payload, False, "responses"), (chat_url, chat_payload, True, "chat")]
                    if use_responses
                    else [(chat_url, chat_payload, True, "chat"), (responses_url, responses_payload, False, "responses")]
                )

                for url, payload, used_chat_api, api_name in attempts:
                    stream_payload = dict(payload)
                    stream_payload["stream"] = True
                    logger.info("[/vision/analyze/stream] try %s API | model=%s | url=%s", api_name, active_model, url)

                    try:
                        async with client.stream("POST", url, headers=headers, json=stream_payload) as resp:
                            if resp.status_code != 200:
                                body = (await resp.aread()).decode("utf-8", errors="ignore")
                                code = infer_chat_error_code(resp.status_code, body)
                                logger.warning(
                                    "[/vision/analyze/stream] %s API failed | model=%s | status=%s | code=%s | body=%s",
                                    api_name,
                                    active_model,
                                    resp.status_code,
                                    code,
                                    truncate_text(body),
                                )
                                if code == "MODEL_NOT_SUPPORTED":
                                    continue

                                yield sse_pack(
                                    {
                                        "type": "error",
                                        "message": format_upstream_error(resp.status_code, body, is_chat=used_chat_api),
                                    }
                                )
                                return

                            emitted_any = False
                            async for raw_line in resp.aiter_lines():
                                line = (raw_line or "").strip()
                                if not line:
                                    continue
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
                                    emitted_any = True
                                    yield sse_pack({"type": "delta", "text": piece})

                            if emitted_any:
                                logger.info("[/vision/analyze/stream] success | model=%s | api=%s", active_model, api_name)
                                yield sse_pack({"type": "done"})
                                return

                            logger.warning("[/vision/analyze/stream] empty stream response | model=%s | api=%s", active_model, api_name)

                    except httpx.TimeoutException:
                        logger.exception("[/vision/analyze/stream] upstream timeout")
                        yield sse_pack({"type": "error", "message": "Model API request timed out."})
                        return
                    except httpx.RequestError as e:
                        logger.exception("[/vision/analyze/stream] upstream request error")
                        yield sse_pack({"type": "error", "message": f"Failed to call model API: {str(e)}"})
                        return

            fallback = get_empty_reply_fallback()
            yield sse_pack({"type": "delta", "text": fallback})
            yield sse_pack({"type": "done"})

    except Exception as e:
        logger.exception("Unhandled /vision/analyze/stream exception")
        yield sse_pack({"type": "error", "message": f"VISION_STREAM_INTERNAL_ERROR: {type(e).__name__}: {str(e)}"})
