from typing import Optional

from fastapi import APIRouter

from ...services.report_service import get_latest_reports

router = APIRouter(tags=["reports"])


@router.get("/reports/latest")
async def reports_latest(period: Optional[str] = None, limit: int = 20, refresh: bool = False):
    return await get_latest_reports(period=period, limit=limit, refresh=refresh)

