from pydantic import BaseModel


class VisionAnalyzeResponse(BaseModel):
    reply: str
