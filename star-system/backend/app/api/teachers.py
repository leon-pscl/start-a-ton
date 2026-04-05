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
from typing import Optional
import json
from datetime import datetime
from app.core.database import get_session
from app.models.models import Teacher, TeacherCreate, TrainingRecord

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
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all() if r.teacher_id
    )

    # Apply filters that require post-processing
    filtered = []
    for t in all_teachers:
        # Parse JSON fields for filtering
        specs = _parse_list(t.subject_specializations)

        # Filter by subject specialization
        if subject and subject not in specs:
            continue

        # Calculate training status
        is_trained = t.id in trained_ids

        # Filter by training status
        if trained is not None and is_trained != trained:
            continue

        # Get training count for this teacher
        training_count = sum(
            1 for r in session.exec(
                select(TrainingRecord).where(TrainingRecord.teacher_id == t.id)
            ).all()
        )

        # Build response object with parsed JSON fields
        filtered.append({
            **t.dict(),
            "subject_specializations": specs,
            "grade_levels_taught":     _parse_list(t.grade_levels_taught),
            "low_confidence_subjects": _parse_list(t.low_confidence_subjects),
            "unapplied_modules":       _parse_list(t.unapplied_modules),
            "is_trained":              is_trained,
            "training_count":          training_count,
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

    # Return teacher with parsed JSON fields and training history
    return {
        **teacher.dict(),
        "subject_specializations": _parse_list(teacher.subject_specializations),
        "grade_levels_taught":     _parse_list(teacher.grade_levels_taught),
        "low_confidence_subjects": _parse_list(teacher.low_confidence_subjects),
        "unapplied_modules":       _parse_list(teacher.unapplied_modules),
        "trainings":               [t.dict() for t in trainings],
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

    # Create the teacher record with JSON-serialized list fields
    teacher = Teacher(
        full_name=payload.full_name,
        region=payload.region,
        division=payload.division,
        school_name=payload.school_name,
        school_type=payload.school_type,
        position=payload.position,
        years_experience=payload.years_experience,
        highest_qualification=payload.highest_qualification,
        # Convert list fields to JSON strings for storage
        subject_specializations=json.dumps(payload.subject_specializations or []),
        grade_levels_taught=json.dumps(payload.grade_levels_taught or []),
        low_confidence_subjects=json.dumps(payload.low_confidence_subjects or []),
        unapplied_modules=json.dumps(payload.unapplied_modules or []),
        distance_to_training=payload.distance_to_training,
        preferred_format=payload.preferred_format,
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
            source="self-registry",
            data_confidence=1.0,
        ))

    session.commit()
    session.refresh(teacher)

    # Return minimal info for confirmation
    return {"id": teacher.id, "full_name": teacher.full_name, "region": teacher.region}