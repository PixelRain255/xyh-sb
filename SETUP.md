# xyh-sb - Minimal FastAPI AI Chat Backend

A short and memorable AI chat application backend built with FastAPI.

## Setup

### 1. Configure Environment
Copy `.env.example` to `.env` and update with your OpenAI credentials:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_BASE_URL`: OpenAI API endpoint (default: https://api.openai.com)
- `OPENAI_MODEL`: Model to use (default: gpt-3.5-turbo)

### 2. Install Dependencies
The dependencies have been installed in the virtual environment `venv/`.

To manually install (if needed):
```bash
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Run the Backend
```bash
source venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or use the startup script:
```bash
chmod +x run.sh
./run.sh
```

The API will be available at `http://localhost:8000`

## API Endpoints

### POST /chat
Send a chat message and get a reply from OpenAI.

**Request:**
```json
{
  "message": "Hello, how are you?"
}
```

**Response:**
```json
{
  "reply": "I'm doing well, thank you for asking!"
}
```

## API Documentation
When the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
