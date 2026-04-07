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

# Weights for each component in the Weighted Priority Index (WPI)
# Higher weights indicate greater impact on identifying priority areas.
WPI_WEIGHTS = {
    "coverage": 0.30,   # Percentage of teachers without any training
    "mismatch": 0.25,   # Subject-qualification mismatch
    "workload": 0.20,   # Student-to-teacher ratio burden
    "distance": 0.15,   # Accessibility (far from centers)
    "recency":  0.10,   # Stale training (3+ years ago)
}

# The "Reward Factor" for historical participation.
# Regions with high per-teacher training completion get this subtracted from their gap.
HISTORICAL_REWARD_WEIGHT = 0.15

# School year threshold for recency calculation
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
    # Mismatch Score: Teachers teaching outside their specialization
    # ---------------------------------------------------------------
    # Count teachers who are assigned to teach at least one subject
    # they are NOT specialized in (subjects_currently_teaching ∩ ¬specializations)
    mismatch_count = 0
    for t in teachers:
        specs    = _parse_json_field(t.subject_specializations)
        teaching = _parse_json_field(t.subjects_currently_teaching)
        if teaching and specs:
            outside = [s for s in teaching if s not in specs]
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
    # Workload Score: Teacher-to-Student Ratio
    # ---------------------------------------------------------------
    # Calculate average student count per teacher in this region
    # A ratio of 45+ is considered "high burden" (1.0 gap)
    total_students = sum(t.student_count or 0 for t in teachers)
    avg_students = total_students / total
    workload_score = min(1.0, avg_students / 45.0)

    # ---------------------------------------------------------------
    # Engagement Score: Historical Participation Reward
    # ---------------------------------------------------------------
    # Reward regions where trained teachers have completed multiple modules
    training_records = session.exec(
        select(TrainingRecord).where(TrainingRecord.region == region)
    ).all()
    # Average modules completed per trained teacher
    trained_count = total - untrained
    modules_per_trained = len(training_records) / trained_count if trained_count > 0 else 0
    # Normalize: 4+ modules is a "perfect" reward score
    engagement_reward = min(1.0, modules_per_trained / 4.0)

    # ---------------------------------------------------------------
    # Compute Weighted Priority Index (WPI)
    # ---------------------------------------------------------------
    # Base gap calculation
    raw_gap = (
        WPI_WEIGHTS["coverage"] * coverage_score
        + WPI_WEIGHTS["mismatch"] * mismatch_score
        + WPI_WEIGHTS["workload"] * workload_score
        + WPI_WEIGHTS["distance"] * distance_score
        + WPI_WEIGHTS["recency"]  * recency_score
    )

    # Apply Historical Reward
    # Rewarding reduces the gap score (making it a lower priority for BASIC intervention
    # but potentially higher for advanced modules - depending on interpretation.
    gap = max(0.0, raw_gap - (HISTORICAL_REWARD_WEIGHT * engagement_reward))

    return {
        "region": region,
        "total_teachers": total,
        "total_students": total_students,
        "trained_count": trained_count,
        "untrained_count": untrained,
        "gap_score": round(gap, 3),
        "gap_level": _level(gap),
        "avg_student_ratio": round(avg_students, 1),
        "engagement_reward": round(engagement_reward, 3),
        "components": {
            "coverage_score": round(coverage_score, 3),
            "mismatch_score": round(mismatch_score, 3),
            "workload_score": round(workload_score, 3),
            "distance_score": round(distance_score, 3),
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
    
def compute_province_gaps(session: Session) -> list[dict]:
    """Compute gap scores grouped by province."""
    teachers = session.exec(select(Teacher)).all()
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all()
        if r.teacher_id
    )
    recent_trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all()
        if r.teacher_id and r.year and r.year >= CURRENT_SY_START
    )

    # Group teachers by province
    by_province: dict[str, list] = {}
    for t in teachers:
        if not t.province:
            continue
        key = (t.region, t.province)
        by_province.setdefault(key, []).append(t)

    results = []
    for (region, province), group in by_province.items():
        total = len(group)
        untrained = sum(1 for t in group if t.id not in trained_ids)
        not_recent = sum(1 for t in group if t.id not in recent_trained_ids)
        far = sum(1 for t in group if t.distance_to_training and '3hrs' in t.distance_to_training)

        mismatch = 0
        for t in group:
            specs     = _parse_json_field(t.subject_specializations)
            low_conf  = _parse_json_field(t.low_confidence_subjects)
            if low_conf and specs:
                if any(s not in specs for s in low_conf):
                    mismatch += 1

        gap = (
            WPI_WEIGHTS['coverage'] * (untrained / total) +
            WPI_WEIGHTS['mismatch'] * (mismatch / total) +
            WPI_WEIGHTS['recency']  * (not_recent / total) +
            WPI_WEIGHTS['distance'] * (far / total)
        )

        results.append({
            'region':          region,
            'province':        province,
            'total_teachers':  total,
            'trained_count':   total - untrained,
            'untrained_count': untrained,
            'gap_score':       round(gap, 3),
            'gap_level':       _level(gap),
        })

    return sorted(results, key=lambda x: -x['gap_score'])


def compute_subject_shortage(session: Session) -> dict:
    """
    Compute subject shortage (mismatch) across all regions.

    For each region, counts how many teachers are teaching each subject
    OUTSIDE their specialization — i.e., the subjects with the most
    out-of-specialization teachers indicate the greatest shortages.

    Returns:
        matrix: { subject -> { region -> mismatch_count } }
        subjects: sorted list of subjects with at least one mismatch
    """
    teachers = session.exec(select(Teacher)).all()

    # { subject -> { region -> count } }
    matrix: dict[str, dict[str, int]] = {}
    # { region -> total_teachers }
    region_totals: dict[str, int] = {}

    for t in teachers:
        region = t.region
        region_totals[region] = region_totals.get(region, 0) + 1

        specs     = _parse_json_field(t.subject_specializations)
        teaching  = _parse_json_field(t.subjects_currently_teaching)

        if not teaching or not specs:
            continue

        # Subjects this teacher is currently teaching outside their specialization
        out_of_specialization = [s for s in teaching if s not in specs]
        for subj in out_of_specialization:
            matrix.setdefault(subj, {}).setdefault(region, 0)
            matrix[subj][region] += 1

    subjects = sorted(matrix.keys())
    return {"matrix": matrix, "subjects": subjects, "region_totals": region_totals}


def compute_city_gaps(session: Session) -> list[dict]:
    """Compute gap scores grouped by city/municipality."""
    teachers = session.exec(select(Teacher)).all()
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all()
        if r.teacher_id
    )
    recent_trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all()
        if r.teacher_id and r.year and r.year >= CURRENT_SY_START
    )

    by_city: dict[str, list] = {}
    for t in teachers:
        if not t.city:
            continue
        key = (t.region, t.province or '', t.city)
        by_city.setdefault(key, []).append(t)

    results = []
    for (region, province, city), group in by_city.items():
        total = len(group)
        untrained = sum(1 for t in group if t.id not in trained_ids)
        not_recent = sum(1 for t in group if t.id not in recent_trained_ids)
        far = sum(1 for t in group if t.distance_to_training and '3hrs' in t.distance_to_training)

        mismatch = 0
        for t in group:
            specs     = _parse_json_field(t.subject_specializations)
            teaching  = _parse_json_field(t.subjects_currently_teaching)
            if teaching and specs:
                if any(s not in specs for s in teaching):
                    mismatch += 1

        gap = (
            WPI_WEIGHTS['coverage'] * (untrained / total) +
            WPI_WEIGHTS['mismatch'] * (mismatch / total) +
            WPI_WEIGHTS['recency']  * (not_recent / total) +
            WPI_WEIGHTS['distance'] * (far / total)
        )

        results.append({
            'region':          region,
            'province':        province,
            'city':            city,
            'total_teachers':  total,
            'trained_count':   total - untrained,
            'untrained_count': untrained,
            'gap_score':       round(gap, 3),
            'gap_level':       _level(gap),
        })

    return sorted(results, key=lambda x: -x['gap_score'])