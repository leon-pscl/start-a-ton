from __future__ import annotations
import json
from datetime import datetime
from sqlmodel import Session, select
from app.models.models import Teacher, TrainingRecord, CANONICAL_REGIONS, STAR_MODULES

WEIGHTS = {
    "distance": 0.20,
    "coverage": 0.35,
    "mismatch": 0.25,
    "recency":  0.20,
}

CURRENT_SY_START = 2022


def _parse_json_field(val: str | None) -> list:
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return [val] if val else []


def compute_region_gap(region: str, session: Session) -> dict:
    teachers = session.exec(
        select(Teacher).where(Teacher.region == region)
    ).all()

    total = len(teachers)
    if total == 0:
        return _empty_gap(region)

    far_count = sum(
        1 for t in teachers
        if t.distance_to_training and "3hrs" in t.distance_to_training
    )
    distance_score = far_count / total

    trained_ids = set(
        row.teacher_id for row in session.exec(select(TrainingRecord)).all()
        if row.teacher_id
    )
    untrained = sum(1 for t in teachers if t.id not in trained_ids)
    coverage_score = untrained / total

    mismatch_count = 0
    for t in teachers:
        specs    = _parse_json_field(t.subject_specializations)
        low_conf = _parse_json_field(t.low_confidence_subjects)
        if low_conf and specs:
            outside = [s for s in low_conf if s not in specs]
            if outside:
                mismatch_count += 1
    mismatch_score = mismatch_count / total

    recent_trained_ids = set(
        row.teacher_id for row in session.exec(select(TrainingRecord)).all()
        if row.teacher_id and row.year and row.year >= CURRENT_SY_START
    )
    not_recent = sum(1 for t in teachers if t.id not in recent_trained_ids)
    recency_score = not_recent / total

    gap = (
        WEIGHTS["distance"] * distance_score
        + WEIGHTS["coverage"] * coverage_score
        + WEIGHTS["mismatch"] * mismatch_score
        + WEIGHTS["recency"]  * recency_score
    )

    return {
        "region": region,
        "total_teachers": total,
        "trained_count": total - untrained,
        "untrained_count": untrained,
        "gap_score": round(gap, 3),
        "gap_level": _level(gap),
        "components": {
            "distance_score": round(distance_score, 3),
            "coverage_score": round(coverage_score, 3),
            "mismatch_score": round(mismatch_score, 3),
            "recency_score":  round(recency_score,  3),
        },
    }


def compute_all_regions(session: Session) -> list[dict]:
    results = [compute_region_gap(r, session) for r in CANONICAL_REGIONS]
    return sorted(results, key=lambda x: -x["gap_score"])


def _level(score: float) -> str:
    if score < 0.40: return "low"
    if score < 0.70: return "moderate"
    return "high"


def _empty_gap(region: str) -> dict:
    return {
        "region": region,
        "total_teachers": 0,
        "trained_count": 0,
        "untrained_count": 0,
        "gap_score": 0.0,
        "gap_level": "low",
        "components": {
            "distance_score": 0.0,
            "coverage_score": 0.0,
            "mismatch_score": 0.0,
            "recency_score":  0.0,
        },
    }