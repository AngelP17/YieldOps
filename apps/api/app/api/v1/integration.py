"""
Integration diagnostics endpoints.

These endpoints are intended to verify runtime wiring between:
- Koyeb-hosted YieldOps API
- Supabase tables feeding Transvec overlays
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.services.supabase_service import supabase_service

router = APIRouter()


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        if ts.endswith("Z"):
            ts = ts.replace("Z", "+00:00")
        value = datetime.fromisoformat(ts)
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    except Exception:
        return None


def _age_seconds(ts: str | None) -> int | None:
    parsed = _parse_iso(ts)
    if not parsed:
        return None
    return int((datetime.now(timezone.utc) - parsed).total_seconds())


def _table_probe(table: str, ts_col: str) -> dict[str, Any]:
    client = supabase_service.client
    result: dict[str, Any] = {
        "table": table,
        "reachable": False,
        "row_count": 0,
        "latest_timestamp": None,
        "latest_age_seconds": None,
        "error": None,
    }
    try:
        count_res = client.table(table).select("id", count="exact", head=True).limit(1).execute()
        result["reachable"] = True
        result["row_count"] = int(getattr(count_res, "count", 0) or 0)

        latest_res = client.table(table).select(ts_col).order(ts_col, desc=True).limit(1).execute()
        latest_ts = (latest_res.data or [{}])[0].get(ts_col) if latest_res.data else None
        result["latest_timestamp"] = latest_ts
        result["latest_age_seconds"] = _age_seconds(latest_ts)
        return result
    except Exception as exc:
        result["error"] = str(exc)
        return result


@router.get("/transvec-pipeline-health")
async def transvec_pipeline_health():
    """
    Returns runtime readiness of tables/events used by Transvec overlays.
    """
    probes = [
        _table_probe("transvec_shipments", "updated_at"),
        _table_probe("transvec_alerts", "created_at"),
        _table_probe("aegis_incidents", "created_at"),
        _table_probe("anomaly_alerts", "created_at"),
        _table_probe("maintenance_logs", "started_at"),
        _table_probe("dispatch_decisions", "dispatched_at"),
        _table_probe("transvec_geofences", "id"),
        _table_probe("geofences", "id"),
    ]

    by_table = {item["table"]: item for item in probes}
    geofence_ready = (
        by_table.get("transvec_geofences", {}).get("reachable")
        or by_table.get("geofences", {}).get("reachable")
    )
    overlay_events_present = (
        (by_table.get("transvec_shipments", {}).get("row_count", 0) > 0)
        and (
            by_table.get("transvec_alerts", {}).get("row_count", 0) > 0
            or by_table.get("aegis_incidents", {}).get("row_count", 0) > 0
            or by_table.get("anomaly_alerts", {}).get("row_count", 0) > 0
        )
    )

    env_ready = {
        "supabase_url": bool(settings.SUPABASE_URL),
        "supabase_service_key": bool(settings.SUPABASE_SERVICE_KEY),
        "supabase_anon_key": bool(settings.SUPABASE_ANON_KEY),
    }

    overlay_pipeline_ready = bool(
        env_ready["supabase_url"]
        and env_ready["supabase_service_key"]
        and by_table.get("transvec_shipments", {}).get("reachable")
        and geofence_ready
        and overlay_events_present
    )

    return {
        "status": "ok",
        "overlay_pipeline_ready": overlay_pipeline_ready,
        "env_ready": env_ready,
        "checks": probes,
        "notes": [
            "Transvec overlays rely on Supabase tables, not direct Koyeb push.",
            "If overlay_pipeline_ready=false, inspect checks[].error and row_count.",
        ],
    }
