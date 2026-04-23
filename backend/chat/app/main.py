import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes.chat import router as chat_router
from .api.routes.reports import router as reports_router
from .api.routes.system import router as system_router

PROJECT_DIR = Path(__file__).resolve().parent.parent

# 优先读取 backend/chat/.env（覆盖系统同名环境变量，避免读到旧值）
load_dotenv(dotenv_path=PROJECT_DIR / ".env", override=True)
# 兼容从工作目录加载 .env（不覆盖上面已加载的值）
load_dotenv(override=False)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


def create_app() -> FastAPI:
    app = FastAPI(title="Minimal FastAPI AI Chat Backend")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(system_router)
    app.include_router(chat_router)
    app.include_router(reports_router)
    return app


app = create_app()


