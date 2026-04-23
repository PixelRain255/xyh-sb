import os
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from ...services.chat_service import model_check_impl

PROJECT_DIR = Path(__file__).resolve().parents[3]
STATIC_DIR = PROJECT_DIR / "static"

router = APIRouter(tags=["system"])


@router.get("/")
async def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "ok": True,
        "service": "backend-chat",
        "message": "backend/chat/static/index.html 不存在，请使用前端服务访问页面。",
        "frontend": "http://127.0.0.1:5188",
    }


@router.get("/health")
async def health():
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


@router.get("/model/check")
async def model_check():
    return await model_check_impl()


@router.get("/health/ready")
async def health_ready():
    result = await model_check_impl()
    return {
        "ok": bool(result.get("ok")),
        "error_code": result.get("error_code"),
        "message": result.get("message"),
        "model": result.get("model"),
    }
