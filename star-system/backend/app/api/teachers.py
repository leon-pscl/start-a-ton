"""
Teacher API Routes

This module provides REST endpoints for teacher management:
- List teachers with filtering (region, subject, training status)
- Get individual teacher details with training history
- Register new teachers via the self-registration portal

All endpoints use SQLModel sessions for database access via dependency injection.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional, Any
import json
from datetime import datetime
from app.core.database import get_session
from app.models.models import Teacher, TeacherCreate, TrainingRecord, normalize_region, normalize_city
from app.services.intelligence import build_teacher_intelligence, build_teacher_payload

# Create a router with the /teachers prefix and "teachers" tag for API docs
router = APIRouter(prefix="/teachers", tags=["teachers"])


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _parse_list(val):
    """
    Parse a JSON-encoded list field from the database.

    Teacher list fields (subject_specializations, etc.) are stored as JSON strings.
    This helper safely parses them back to Python lists.

    Args:
        val: The JSON string or None

    Returns:
        list: Parsed list, or empty list if invalid/empty
    """
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return [val]


# ---------------------------------------------------------------------------
# List Teachers Endpoint
# ---------------------------------------------------------------------------

@router.get("")
def list_teachers(
    region:  Optional[str]  = Query(None),   # Filter by region (optional)
    subject: Optional[str]  = Query(None),   # Filter by subject specialization (optional)
    trained: Optional[bool] = Query(None),   # Filter by training status (optional)
    search: Optional[str]   = Query(None),   # Search by name or school (optional)
    limit:   int            = Query(50, le=1000),  # Max results per page
    offset:  int            = 0,             # Pagination offset
    session: Session        = Depends(get_session),
):
    """
    List teachers with optional filtering and pagination.

    Supports filtering by:
    - region: Philippine region name (canonical form)
    - subject: Subject specialization
    - trained: Whether the teacher has any STAR training

    Returns paginated results with teacher details and computed fields
    (is_trained, training_count) for frontend display.
    """
    # Build base query
    q = select(Teacher)

    # Apply region filter at database level (more efficient)
    if region:
        q = q.where(Teacher.region == region)

    # Get all teachers (need to process in Python for complex filters)
    all_teachers = session.exec(q).all()

    # Get all trained teacher IDs for the is_trained calculation
    training_records = session.exec(select(TrainingRecord)).all()
    trained_ids = set(r.teacher_id for r in training_records if r.teacher_id)
    teacher_trainings: dict[str, list[TrainingRecord]] = {}
    for training in training_records:
        if training.teacher_id:
            teacher_trainings.setdefault(training.teacher_id, []).append(training)

    # Apply filters that require post-processing
    filtered = []
    for t in all_teachers:
        # Parse JSON fields for filtering
        specs = _parse_list(t.subject_specializations)

        # Filter by search (name or school)
        if search:
            haystack = f"{t.full_name or ''} {t.school_name or ''}".lower()
            if search.lower() not in haystack:
                continue

        # Filter by subject specialization
        if subject and subject not in specs:
            continue

        # Calculate training status
        is_trained = t.id in trained_ids

        # Filter by training status
        if trained is not None and is_trained != trained:
            continue

        # Get training count for this teacher
        training_count = len(teacher_trainings.get(t.id, []))
        intelligence = build_teacher_intelligence(t, teacher_trainings.get(t.id, []))

        # Build response object with parsed JSON fields
        filtered.append({
            **t.dict(),
            "subject_specializations":    specs,
            "subjects_currently_teaching": _parse_list(t.subjects_currently_teaching),
            "grade_levels_taught":        _parse_list(t.grade_levels_taught),
            "low_confidence_subjects":    _parse_list(t.low_confidence_subjects),
            "unapplied_modules":          _parse_list(t.unapplied_modules),
            "preferred_relocation_regions": _parse_list(t.preferred_relocation_regions),
            "is_trained":                 is_trained,
            "training_count":             training_count,
            **{k: intelligence[k] for k in (
                "degree_program",
                "primary_specialization",
                "preferred_relocation_regions",
                "preferred_relocation_type",
                "last_training_year",
                "competency_score",
                "competency_level",
                "competency_breakdown",
                "training_recency_years",
                "is_out_of_field",
                "out_of_field_subjects",
                "identified_gaps",
                "recommendations",
                "recommended_modules",
                "recommended_action",
                "auto_tags",
            )},
        })

    # Calculate pagination metadata
    total = len(filtered)
    page_items = filtered[offset: offset + limit]

    return {
        "total":   total,
        "offset":  offset,
        "limit":   limit,
        "pages":   -(-total // limit),  # Ceiling division for total pages
        "results": page_items,
    }


# ---------------------------------------------------------------------------
# Get Single Teacher Endpoint
# ---------------------------------------------------------------------------

@router.get("/{teacher_id}")
def get_teacher(teacher_id: str, session: Session = Depends(get_session)):
    """
    Get detailed information for a single teacher.

    Includes the teacher's profile and all their training records.
    Returns 404 if teacher not found.

    Args:
        teacher_id: UUID of the teacher

    Returns:
        dict: Teacher profile with training history
    """
    # Fetch teacher from database
    teacher = session.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Fetch all training records for this teacher
    trainings = session.exec(
        select(TrainingRecord).where(TrainingRecord.teacher_id == teacher_id)
    ).all()
    intelligence = build_teacher_intelligence(teacher, trainings)

    # Return teacher with parsed JSON fields and training history
    return {
        **teacher.dict(),
        "subject_specializations":     _parse_list(teacher.subject_specializations),
        "subjects_currently_teaching": _parse_list(teacher.subjects_currently_teaching),
        "grade_levels_taught":        _parse_list(teacher.grade_levels_taught),
        "low_confidence_subjects":    _parse_list(teacher.low_confidence_subjects),
        "unapplied_modules":          _parse_list(teacher.unapplied_modules),
        "preferred_relocation_regions": _parse_list(teacher.preferred_relocation_regions),
        "trainings":                  [t.dict() for t in trainings],
        **{k: intelligence[k] for k in (
            "degree_program",
            "primary_specialization",
            "preferred_relocation_regions",
            "preferred_relocation_type",
            "last_training_year",
            "competency_score",
            "competency_level",
            "competency_breakdown",
            "training_recency_years",
            "is_out_of_field",
            "out_of_field_subjects",
            "identified_gaps",
            "recommendations",
            "recommended_modules",
            "recommended_action",
            "auto_tags",
            "training_history",
        )},
    }


@router.patch("/{teacher_id}")
def update_teacher(teacher_id: str, payload: dict[str, Any], session: Session = Depends(get_session)):
    """
    Update an existing teacher profile.

    Used by the teacher portal to save relocation and training preferences.
    """
    teacher = session.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    current = {
        "full_name": teacher.full_name,
        "region": teacher.region,
        "province": teacher.province,
        "city": teacher.city,
        "division": teacher.division,
        "school_name": teacher.school_name,
        "school_type": teacher.school_type,
        "position": teacher.position,
        "years_experience": teacher.years_experience,
        "graduation_year": teacher.graduation_year,
        "highest_qualification": teacher.highest_qualification,
        "degree_program": teacher.degree_program,
        "primary_specialization": teacher.primary_specialization,
        "subject_specializations": _parse_list(teacher.subject_specializations),
        "subjects_currently_teaching": _parse_list(teacher.subjects_currently_teaching),
        "grade_levels_taught": _parse_list(teacher.grade_levels_taught),
        "low_confidence_subjects": _parse_list(teacher.low_confidence_subjects),
        "unapplied_modules": _parse_list(teacher.unapplied_modules),
        "distance_to_training": teacher.distance_to_training,
        "student_count": teacher.student_count,
        "preferred_format": teacher.preferred_format,
        "preferred_relocation_regions": _parse_list(teacher.preferred_relocation_regions),
        "preferred_relocation_type": teacher.preferred_relocation_type,
        "last_training_year": teacher.last_training_year,
        "trainings_attended": [],
    }
    current.update(payload or {})
    normalized = build_teacher_payload(current, teacher.region)

    teacher.degree_program = normalized.get("degree_program")
    teacher.primary_specialization = normalized.get("primary_specialization")
    teacher.graduation_year = normalized.get("graduation_year")
    teacher.preferred_relocation_regions = json.dumps(normalized.get("preferred_relocation_regions") or [])
    teacher.preferred_relocation_type = normalized.get("preferred_relocation_type")
    teacher.preferred_format = normalized.get("preferred_format")
    teacher.last_training_year = normalized.get("last_training_year")
    teacher.updated_at = datetime.utcnow()
    session.add(teacher)
    session.commit()
    session.refresh(teacher)

    trainings = session.exec(select(TrainingRecord).where(TrainingRecord.teacher_id == teacher_id)).all()
    intelligence = build_teacher_intelligence(teacher, trainings)

    return {
        **teacher.dict(),
        "preferred_relocation_regions": _parse_list(teacher.preferred_relocation_regions),
        **{k: intelligence[k] for k in (
            "degree_program",
            "primary_specialization",
            "preferred_relocation_type",
            "last_training_year",
            "competency_score",
            "competency_level",
            "competency_breakdown",
            "training_recency_years",
            "is_out_of_field",
            "out_of_field_subjects",
            "identified_gaps",
            "recommendations",
            "recommended_modules",
            "recommended_action",
            "auto_tags",
        )},
    }


# ---------------------------------------------------------------------------
# Register Teacher Endpoint
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
def register_teacher(payload: TeacherCreate, session: Session = Depends(get_session)):
    """
    Register a new teacher via the self-registration portal.

    Creates a teacher record and any associated training records.
    Training records are created from the trainings_attended list.

    Args:
        payload: Teacher registration data from the frontend form

    Returns:
        dict: Created teacher info (id, name, region)
    """
    now = datetime.utcnow()
    normalized = build_teacher_payload(payload.dict(), payload.region)

    # Create the teacher record with JSON-serialized list fields
    # Normalize region and city names to canonical forms
    teacher = Teacher(
        full_name=normalized.get("full_name"),
        region=normalize_region(normalized.get("region") or ""),
        province=normalized.get("province"),
        city=normalize_city(normalized.get("city")) if normalized.get("city") else None,
        division=normalized.get("division"),
        school_name=normalized.get("school_name"),
        school_type=normalized.get("school_type"),
        position=normalized.get("position"),
        years_experience=normalized.get("years_experience"),
        graduation_year=normalized.get("graduation_year"),
        highest_qualification=normalized.get("highest_qualification"),
        degree_program=normalized.get("degree_program"),
        primary_specialization=normalized.get("primary_specialization"),
        # Convert list fields to JSON strings for storage
        subject_specializations=json.dumps(normalized.get("subject_specializations") or []),
        subjects_currently_teaching=json.dumps(normalized.get("subjects_currently_teaching") or []),
        grade_levels_taught=json.dumps(normalized.get("grade_levels_taught") or []),
        low_confidence_subjects=json.dumps(normalized.get("low_confidence_subjects") or []),
        unapplied_modules=json.dumps(normalized.get("unapplied_modules") or []),
        distance_to_training=normalized.get("distance_to_training"),
        preferred_format=normalized.get("preferred_format"),
        preferred_relocation_regions=json.dumps(normalized.get("preferred_relocation_regions") or []),
        preferred_relocation_type=normalized.get("preferred_relocation_type"),
        last_training_year=normalized.get("last_training_year"),
        source="self-registry",           # Mark as self-registered
        data_confidence=1.0,              # Highest confidence for user-entered data
        created_at=now,
        updated_at=now,
    )
    session.add(teacher)
    session.flush()  # Flush to get the teacher ID for training records

    # Create training records for each module attended
    for module_name in (payload.trainings_attended or []):
        session.add(TrainingRecord(
            teacher_id=teacher.id,
            module_name=module_name,
            year=normalized.get("last_training_year") or now.year,
            source="self-registry",
            data_confidence=1.0,
        ))

    session.commit()
    session.refresh(teacher)

    # Return minimal info for confirmation
    return {"id": teacher.id, "full_name": teacher.full_name, "region": teacher.region}