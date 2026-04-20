# PROJECT MEMORY

最后更新：2026-04-19

## 1) 当前项目结构
- 前端入口：`frontend/index/server.js`
- 后端入口：`backend/main.py`（以及 `backend/chat/app/main.py`）
- Python 依赖：`backend/requirements.txt`

## 2) 前端当前状态（已确认）
- 主题：米白金（保留主色调，增加层次色）
- 标题：`观数知财`，带慢速上下浮动动画（CSS `titleFloat`）
- 已移除右上角按钮：`专业版咨询 💰`
- 页面为 Node 单文件服务（HTML/CSS/JS 内嵌）
- 前端推荐访问地址：`http://127.0.0.1:5188`

## 3) 前端运行方式
```bash
node frontend/index/server.js
```

## 4) 后端运行方式（Python）
先进入项目根目录：
```bash
cd /Users/Admin/Documents/GitHub/xyh-sb
```

激活虚拟环境：
```bash
source .venv/bin/activate
```

启动示例（按你的文件选择）：
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8010 --reload
```

## 5) Python 命令兼容处理（已做）
用户终端已增加：
- `alias python='python3'`
- `alias pip='pip3'`

如果新终端没生效，重开终端或执行：
```bash
source ~/.zshrc
```

## 6) 常见问题记录
- 看到“修改没生效”通常是旧端口进程还在跑；优先换新端口或先 kill 旧进程。
- `GET /favicon.ico 404` 不影响主功能，可忽略。
- 前端不依赖 Python；仅后端需要 Python 环境。

## 7) 下一步建议
- 如需长期维护，建议把前端从单文件拆分为：
  - `frontend/src/`
  - `frontend/public/`
  - `frontend/services/`
  - `frontend/styles/`
