#!/usr/bin/env python3
"""
ReelDive Reporter Agent
Auto-configured push reporter for the ReelDive project.
Drop this file into any agent or project and call report_update() or report_session() immediately.
No setup required.
"""

import json
import traceback
from datetime import datetime

try:
    import requests
except ImportError:
    raise ImportError("The 'requests' library is required. Install it with: pip install requests")

# ── Hardcoded project config ─────────────────────────────────────────────────
TRACKER_URL = "http://localhost:3000/api/project-update"
AGENT_KEY   = "dev-agent-key"
PROJECT     = "ReelDive"
DEFAULT_MODEL = "none"
TIMEOUT     = 15  # seconds
# ─────────────────────────────────────────────────────────────────────────────


def _build_payload(update: dict) -> dict:
    """Merge caller-supplied fields with hardcoded defaults."""
    payload = {
        "type":          update.get("type", "progress"),
        "project":       PROJECT,
        "summary":       update.get("summary", ""),
        "detail":        update.get("detail", ""),
        "model_used":    update.get("model_used", DEFAULT_MODEL),
        "status":        update.get("status", "Active"),
        "blockers":      update.get("blockers", []),
        "next_steps":    update.get("next_steps", []),
        "confidence":    update.get("confidence", 0.8),
        "missing_fields": update.get("missing_fields", []),
        "timestamp":     datetime.utcnow().isoformat() + "Z",
    }
    return payload


def report_update(update_dict: dict) -> dict:
    """
    Send an arbitrary update dict to the ReelDive tracker.
    All required fields are defaulted; callers only need to supply what changed.
    Returns the parsed JSON response on success, or an error dict on failure.
    """
    payload = _build_payload(update_dict)
    headers = {
        "Content-Type": "application/json",
        "x-agent-key":  AGENT_KEY,
    }
    try:
        resp = requests.post(
            TRACKER_URL,
            headers=headers,
            data=json.dumps(payload),
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return {"status": "ok", "raw": resp.text}
    except requests.exceptions.RequestException as exc:
        error_detail = traceback.format_exc()
        # Attempt to report the failure itself as a blocker
        _report_error_silently(str(exc), error_detail)
        return {"error": str(exc), "detail": error_detail}


def report_session(
    summary: str,
    detail: str,
    status: str = "Active",
    next_steps: list = None,
    blockers: list = None,
    update_type: str = "progress",
    confidence: float = 0.8,
    model_used: str = None,
) -> dict:
    """
    Convenience wrapper for the most common reporting pattern.
    Call at the end of every agent work session.
    """
    return report_update({
        "type":       update_type,
        "summary":    summary,
        "detail":     detail,
        "status":     status,
        "next_steps": next_steps or [],
        "blockers":   blockers or [],
        "confidence": confidence,
        "model_used": model_used or DEFAULT_MODEL,
    })


def _report_error_silently(error_msg: str, tb: str = "") -> None:
    """Best-effort error report — never raises, used internally."""
    payload = _build_payload({
        "type":       "blocker",
        "summary":    f"[ReelDive Reporter] Error encountered: {error_msg[:120]}",
        "detail":     f"Traceback:\n{tb}" if tb else error_msg,
        "status":     "Blocked",
        "blockers":   [error_msg[:200]],
        "confidence": 0.5,
    })
    headers = {
        "Content-Type": "application/json",
        "x-agent-key":  AGENT_KEY,
    }
    try:
        requests.post(
            TRACKER_URL,
            headers=headers,
            data=json.dumps(payload),
            timeout=TIMEOUT,
        )
    except Exception:
        pass  # Truly silent fallback


# ── Standalone first-run block ────────────────────────────────────────────────
if __name__ == "__main__":
    first_update = {
        "type":       "feature",
        "summary":    "ReelDive push reporter has been deployed and is operational",
        "detail":     (
            "The ReelDive reporter agent has been fully configured and dropped into the project. "
            "It is pre-loaded with the tracker endpoint (http://localhost:3000/api/project-update), "
            "the project name (ReelDive), and the agent key. "
            "The reporter exposes report_update(update_dict) for arbitrary updates and "
            "report_session(summary, detail, status, next_steps, blockers) for end-of-session "
            "convenience reporting. Auto-error detection is active: any exception during a "
            "report attempt will itself be forwarded as a blocker update. "
            "Prep config was previously created for ReelDive; this agent will now track all "
            "ongoing progress, features, blockers, and daily updates for the project. "
            "Stack and model details are pending — these can be enriched in future updates."
        ),
        "model_used": "none",
        "status":     "Active",
        "blockers":   [],
        "next_steps": [
            "Integrate report_session() call at the end of each autonomous agent work loop",
            "Confirm tracker endpoint is reachable from the deployment environment",
            "Enrich future updates with stack details and model name as they become available",
        ],
        "confidence":     0.95,
        "missing_fields": [],
    }

    print(f"[ReelDive Reporter] Sending first update to {TRACKER_URL} ...")
    result = report_update(first_update)
    print(f"[ReelDive Reporter] Response: {json.dumps(result, indent=2)}")
