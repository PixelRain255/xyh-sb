import asyncio
import json

import httpx


async def main():
    url = "http://127.0.0.1:8000/model/check"

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url)

    print(f"status_code: {resp.status_code}")
    try:
        print(json.dumps(resp.json(), ensure_ascii=False, indent=2))
    except Exception:
        print(resp.text)


if __name__ == "__main__":
    asyncio.run(main())
