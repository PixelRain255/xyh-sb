import asyncio
import json

import httpx


async def main():
    url = "http://127.0.0.1:8000/chat"
    payload = {"message": "你好，请用一句话介绍 FastAPI。"}

    try:
        timeout = httpx.Timeout(90.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)

        print(f"status_code: {resp.status_code}")
        try:
            print("response:")
            print(json.dumps(resp.json(), ensure_ascii=False, indent=2))
        except Exception:
            print(resp.text)

    except httpx.TimeoutException:
        print("请求超时：请检查后端服务是否运行，或模型接口是否可访问。")
    except httpx.ConnectError:
        print("连接失败：请先启动 FastAPI 服务（uvicorn main:app --reload）。")


if __name__ == "__main__":
    asyncio.run(main())









