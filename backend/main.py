import os
from typing import Any, Dict

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Minimal FastAPI AI Chat Backend")

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

    url = base_url.rstrip("/") + "/v1/chat/completions"

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
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, json=payload)

        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Upstream model API error: {resp.status_code}, body: {resp.text}",
            )

        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return ChatResponse(reply=reply)

    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to call model API: {str(e)}")
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail=f"Unexpected model API response: {resp.text}")
