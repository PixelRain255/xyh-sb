import logging
import math
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

try:
    import akshare as ak
except Exception:  # pragma: no cover
    ak = None


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, float) and math.isnan(value):
        return True
    return False


def _pick_value(row: Any, *keys: str, default: str = "") -> str:
    for key in keys:
        try:
            value = row.get(key)
        except Exception:
            value = None
        if not _is_empty(value):
            return str(value).strip()
    return default


def _normalize_period(raw_period: Optional[str]) -> str:
    raw = (raw_period or "").strip().replace("-", "")
    if raw:
        if len(raw) == 8 and raw.isdigit():
            return raw
        raise HTTPException(status_code=400, detail="period must be YYYYMMDD, e.g. 20250331")

    today = date.today()
    if today.month <= 3:
        return f"{today.year - 1}1231"
    if today.month <= 6:
        return f"{today.year}0331"
    if today.month <= 9:
        return f"{today.year}0630"
    return f"{today.year}0930"


def _period_to_label(period: str) -> str:
    mmdd = period[4:]
    quarter_map = {
        "0331": "Q1",
        "0630": "Q2",
        "0930": "Q3",
        "1231": "年报",
    }
    return f"{period[:4]} {quarter_map.get(mmdd, period[4:])}"


def _to_date_text(value: Any) -> str:
    if _is_empty(value):
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            pass
    text = str(value).strip().replace("/", "-")
    return text[:10] if len(text) >= 10 else text


def _build_quote_url(code: str) -> str:
    pure = (code or "").strip()
    if not pure:
        return "https://quote.eastmoney.com/"
    market = "sh" if pure.startswith(("5", "6", "9")) else "sz"
    return f"https://quote.eastmoney.com/{market}{pure}.html"


def _build_report_item(row: Any, period: str, report_type: str) -> Dict[str, str]:
    code = _pick_value(row, "股票代码", "代码", "证券代码", "股票简称")
    name = _pick_value(row, "股票简称", "名称", "证券简称", default="未知公司")
    published_at = _to_date_text(_pick_value(row, "最新公告日期", "公告日期", "最新公告日", "更新日期"))

    period_label = _period_to_label(period)
    return {
        "id": f"{report_type}-{code}-{period}",
        "title": f"{period_label} {report_type}",
        "company": name,
        "period": period_label,
        "type": report_type,
        "source": "东方财富（AKShare）",
        "publishedAt": published_at or "-",
        "url": _build_quote_url(code),
    }


async def get_latest_reports(period: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    if ak is None:
        raise HTTPException(status_code=500, detail="AKSHARE_NOT_INSTALLED: pip install akshare")

    normalized_period = _normalize_period(period)
    limit = max(1, min(limit, 100))

    items: List[Dict[str, str]] = []
    errors: List[str] = []

    try:
        df_bb = ak.stock_yjbb_em(date=normalized_period)
        if df_bb is not None and not df_bb.empty:
            for _, row in df_bb.head(limit * 2).iterrows():
                items.append(_build_report_item(row, normalized_period, "业绩报表"))
    except Exception as e:
        logger.exception("[/reports/latest] stock_yjbb_em failed")
        errors.append(f"stock_yjbb_em failed: {type(e).__name__}: {str(e)}")

    try:
        df_kb = ak.stock_yjkb_em(date=normalized_period)
        if df_kb is not None and not df_kb.empty:
            for _, row in df_kb.head(limit * 2).iterrows():
                items.append(_build_report_item(row, normalized_period, "业绩快报"))
    except Exception as e:
        logger.exception("[/reports/latest] stock_yjkb_em failed")
        errors.append(f"stock_yjkb_em failed: {type(e).__name__}: {str(e)}")

    dedup: Dict[str, Dict[str, str]] = {}
    for item in items:
        dedup.setdefault(item["id"], item)

    ordered = sorted(dedup.values(), key=lambda x: x.get("publishedAt", ""), reverse=True)

    return {
        "ok": True,
        "period": normalized_period,
        "count": len(ordered[:limit]),
        "items": ordered[:limit],
        "errors": errors,
    }
