# xyh-sb

前后端联调的 FastAPI + Node 演示项目。

## 当前目录结构（关键）

- 后端入口：`backend/chat/app/main.py`
- 前端服务：`frontend/index/server.js`
- 后端测试脚本：
  - `backend/chat/scripts/test_model_check.py`
  - `backend/chat/scripts/test_api.py`

## 1) 后端启动

在项目根目录执行：

```powershell
python -m uvicorn backend.chat.app.main:app --host 127.0.0.1 --port 8010
```

> 建议开发时先固定端口（例如 8010），减少 8000 端口残留进程冲突。

## 2) 前端启动

默认前端会请求 `http://127.0.0.1:8010`。

```powershell
node frontend/index/server.js
```

打开页面：`http://127.0.0.1:5188`

## 3) 前端后端地址（自动配置）

可用环境变量覆盖前端请求地址：

- `BACKEND_HOST`（默认 `127.0.0.1`）
- `BACKEND_PORT`（默认 `8010`）

示例（PowerShell）：

```powershell
$env:BACKEND_HOST="127.0.0.1"
$env:BACKEND_PORT="8000"
node frontend/index/server.js
```

## 4) 后端环境变量（`backend/chat/.env`）

至少需要：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

可选增强：

- `OPENAI_USE_RESPONSES_API=true`
- `OPENAI_FALLBACK_MODEL=模型A,模型B`
- `OPENAI_EMPTY_REPLY_FALLBACK=系统繁忙，请稍后再试`
- `LOG_LEVEL=INFO`（或 `DEBUG`）

## 5) 快速自检

```powershell
python backend/chat/scripts/test_model_check.py
python backend/chat/scripts/test_api.py
```

## 6) 常见问题

### 网页显示“后端不可达”
通常是端口不一致：
- 后端跑在 8010，但前端还指向 8000
- 或后端没启动

### `/model/check` 正常但 `/chat` 失败
优先看后端日志中 `[/chat]` 相关行，已包含：
- 调用的 API 类型（chat / responses）
- 上游状态码
- 上游返回体截断片段

### PowerShell 粘贴时报 PSReadLine 异常
可临时执行：

```powershell
Remove-Module PSReadLine
```

## 7) 说明

- `run.sh`、`SETUP.md` 为旧流程文件，现已标记弃用。
- 推荐只以本 README 为准。 

