"""
Gap Score Calculation Service

This module calculates "gap scores" for each Philippine region to identify
areas most in need of STAR training intervention. The gap score is a composite
metric combining four factors:

1. Distance Score (20%): Teachers far from training centers (>3 hours)
2. Coverage Score (35%): Teachers who have never received STAR training
3. Mismatch Score (25%): Teachers teaching subjects outside their specialization
4. Recency Score (20%): Teachers whose last training was 3+ years ago

The final gap score ranges from 0 (low need) to 1 (high need).

Regions are classified into three levels:
- Low (< 40%): Well-served by current training programs
- Moderate (40-69%): Some gaps, needs attention
- High (>= 70%): Priority areas for intervention
"""

from __future__ import annotations
import json
from datetime import datetime
from sqlmodel import Session, select
from app.models.models import Teacher, TrainingRecord, CANONICAL_REGIONS, STAR_MODULES

# ---------------------------------------------------------------------------
# Gap Score Weights
# ---------------------------------------------------------------------------

# Weights for each component in the final score
# These were determined based on program priorities:
# - Coverage (untrained teachers) is weighted highest as it's the primary concern
# - Mismatch (teaching outside specialization) affects teaching quality
# - Distance and Recency are secondary factors
WEIGHTS = {
    "distance": 0.20,   # Accessibility of training centers
    "coverage": 0.35,   # Percentage of teachers without any training
    "mismatch": 0.25,   # Subject-qualification mismatch
    "recency":  0.20,   # Training more than 3 years old
}

# School year threshold for recency calculation
# Teachers trained before this year are considered "not recently trained"
CURRENT_SY_START = 2022


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _parse_json_field(val: str | None) -> list:
    """
    Safely parse a JSON-encoded list field.

    Args:
        val: JSON string from database, or None

    Returns:
        list: Parsed list, or empty list if parsing fails
    """
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return [val] if val else []


# ---------------------------------------------------------------------------
# Region Gap Score Calculation
# ---------------------------------------------------------------------------

def compute_region_gap(region: str, session: Session) -> dict:
    """
    Compute the gap score for a single region.

    Analyzes all teachers in the region and calculates component scores
    based on the four weighted factors.

    Args:
        region: Canonical region name (e.g., "NCR", "Region I")
        session: Database session for queries

    Returns:
        dict: Gap analysis including:
            - region: Region name
            - total_teachers: Total teacher count
            - trained_count: Teachers with at least one training
            - untrained_count: Teachers with no training
            - gap_score: Composite score (0-1)
            - gap_level: Classification (low/moderate/high)
            - components: Individual factor scores
    """
    # Get all teachers in this region
    teachers = session.exec(
        select(Teacher).where(Teacher.region == region)
    ).all()

    total = len(teachers)

    # Handle empty regions
    if total == 0:
        return _empty_gap(region)

    # ---------------------------------------------------------------
    # Distance Score: Teachers far from training centers
    # ---------------------------------------------------------------
    # Count teachers whose travel time to nearest center is 3+ hours
    far_count = sum(
        1 for t in teachers
        if t.distance_to_training and "3hrs" in t.distance_to_training
    )
    distance_score = far_count / total

    # ---------------------------------------------------------------
    # Coverage Score: Teachers without any training
    # ---------------------------------------------------------------
    # Get all teacher IDs who have at least one training record
    trained_ids = set(
        row.teacher_id for row in session.exec(select(TrainingRecord)).all()
        if row.teacher_id
    )
    untrained = sum(1 for t in teachers if t.id not in trained_ids)
    coverage_score = untrained / total

    # ---------------------------------------------------------------
    # Mismatch Score: Teachers outside their specialization
    # ---------------------------------------------------------------
    # Count teachers teaching subjects they lack confidence in
    # (subjects in low_confidence_subjects but not in specializations)
    mismatch_count = 0
    for t in teachers:
        specs    = _parse_json_field(t.subject_specializations)
        low_conf = _parse_json_field(t.low_confidence_subjects)
        if low_conf and specs:
            # Find subjects teacher lacks confidence in but is teaching
            outside = [s for s in low_conf if s not in specs]
            if outside:
                mismatch_count += 1
    mismatch_score = mismatch_count / total

    # ---------------------------------------------------------------
    # Recency Score: Teachers not recently trained
    # ---------------------------------------------------------------
    # Get teacher IDs who have training records from recent years
    recent_trained_ids = set(
        row.teacher_id for row in session.exec(select(TrainingRecord)).all()
        if row.teacher_id and row.year and row.year >= CURRENT_SY_START
    )
    not_recent = sum(1 for t in teachers if t.id not in recent_trained_ids)
    recency_score = not_recent / total

    # ---------------------------------------------------------------
    # Compute Weighted Average
    # ---------------------------------------------------------------
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
    """
    Compute gap scores for all regions.

    Returns regions sorted by gap score (highest first) to prioritize
    regions most in need of intervention.

    Args:
        session: Database session

    Returns:
        list[dict]: Gap analysis for each region, sorted by need
    """
    results = [compute_region_gap(r, session) for r in CANONICAL_REGIONS]
    return sorted(results, key=lambda x: -x["gap_score"])


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _level(score: float) -> str:
    """
    Classify a gap score into a level.

    Args:
        score: Gap score between 0 and 1

    Returns:
        str: Classification ('low', 'moderate', or 'high')
    """
    if score < 0.40: return "low"
    if score < 0.70: return "moderate"
    return "high"


def _empty_gap(region: str) -> dict:
    """
    Return an empty gap analysis for regions with no data.

    Used when a region has no teachers in the database.
    """
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