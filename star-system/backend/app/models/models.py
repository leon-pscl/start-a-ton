"""
STAR System Data Models

This module defines the database models and data schemas for the STAR system:
- Teacher: Core entity representing a science/math teacher
- TrainingRecord: Tracks STAR module completions per teacher
- ImportLog: Audit trail for data imports

Also includes:
- Controlled vocabularies for regions, subjects, and STAR modules
- Normalization functions to standardize user input
- Pydantic schemas for API request/response validation

The models use SQLModel which combines SQLAlchemy ORM with Pydantic validation.
"""

from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid


# ---------------------------------------------------------------------------
# UUID Generation
# ---------------------------------------------------------------------------

def gen_uuid():
    """
    Generate a unique identifier for database records.

    Returns:
        str: A UUID4 string for use as primary key
    """
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Controlled Vocabulary: Regions
# ---------------------------------------------------------------------------

# Mapping of region name aliases to canonical names
# This allows flexible user input while maintaining data consistency
# e.g., "NCR", "Metro Manila", "National Capital Region" all map to "NCR"
REGION_ALIASES = {
    "NCR": "NCR", "NATIONAL CAPITAL REGION": "NCR", "METRO MANILA": "NCR",
    "CAR": "CAR", "CORDILLERA": "CAR", "CORDILLERA ADMINISTRATIVE REGION": "CAR",
    "REGION I": "Region I", "R1": "Region I", "ILOCOS": "Region I",
    "REGION II": "Region II", "R2": "Region II", "CAGAYAN VALLEY": "Region II",
    "REGION III": "Region III", "R3": "Region III", "CENTRAL LUZON": "Region III",
    "REGION IV-A": "Region IV-A", "R4A": "Region IV-A", "CALABARZON": "Region IV-A",
    "REGION IV-B": "Region IV-B", "R4B": "Region IV-B", "MIMAROPA": "Region IV-B",
    "REGION V": "Region V", "R5": "Region V", "BICOL": "Region V",
    "REGION VI": "Region VI", "R6": "Region VI", "WESTERN VISAYAS": "Region VI",
    "REGION VII": "Region VII", "R7": "Region VII", "CENTRAL VISAYAS": "Region VII",
    "REGION VIII": "Region VIII", "R8": "Region VIII", "EASTERN VISAYAS": "Region VIII",
    "REGION IX": "Region IX", "R9": "Region IX", "ZAMBOANGA PENINSULA": "Region IX",
    "REGION X": "Region X", "R10": "Region X", "NORTHERN MINDANAO": "Region X",
    "REGION XI": "Region XI", "R11": "Region XI", "DAVAO": "Region XI",
    "REGION XII": "Region XII", "R12": "Region XII", "SOCCSKSARGEN": "Region XII",
    "REGION XIII": "Region XIII", "R13": "Region XIII", "CARAGA": "Region XIII",
    "BARMM": "BARMM", "ARMM": "BARMM", "BANGSAMORO": "BARMM",
}

# ---------------------------------------------------------------------------
# Controlled Vocabulary: Subjects
# ---------------------------------------------------------------------------

# Mapping of subject name aliases to canonical names
# Standardizes how subjects are stored regardless of input format
SUBJECT_ALIASES = {
    "SCIENCE": "General Science", "SCI": "General Science", "GENERAL SCIENCE": "General Science",
    "BIOLOGY": "Biology", "BIO": "Biology", "EARTH AND LIFE SCIENCE": "Biology",
    "CHEMISTRY": "Chemistry", "CHEM": "Chemistry",
    "PHYSICS": "Physics", "PHY": "Physics",
    "EARTH SCIENCE": "Earth Science", "EARTH SCI": "Earth Science",
    "MATHEMATICS": "Mathematics", "MATH": "Mathematics", "MTH": "Mathematics",
    "STATISTICS": "Statistics", "STAT": "Statistics",
}

# ---------------------------------------------------------------------------
# Controlled Vocabulary: STAR Modules
# ---------------------------------------------------------------------------

# The 7 capacity-building modules offered by the STAR program
# These are standardized training programs for science and math teachers
STAR_MODULES = [
    "Teaching Mathematics through Problem Solving",
    "Inquiry-based Approach for Teaching Science",
    "Interdisciplinary Contextualization",
    "Language Strategies for Teaching Science and Mathematics",
    "Design Thinking for K-3 Science and Mathematics",
    "Designing Assessment Activities for Blended Learning",
    "Instrumentation and Improvisation",
]

# Derived list of canonical region names (unique, sorted)
CANONICAL_REGIONS = sorted(set(REGION_ALIASES.values()))


# ---------------------------------------------------------------------------
# Normalization Functions
# ---------------------------------------------------------------------------

def normalize_region(raw: str) -> str:
    """
    Convert user-provided region name to canonical form.

    This ensures consistent storage regardless of how the user enters
    the region name (e.g., "NCR", "ncr", "National Capital Region" → "NCR").

    Args:
        raw: The raw region name from user input or import

    Returns:
        str: Canonical region name, or "Unknown" if input is empty
    """
    if not raw:
        return "Unknown"
    return REGION_ALIASES.get(raw.strip().upper(), raw.strip())


def normalize_subject(raw: str) -> str:
    """
    Convert user-provided subject name to canonical form.

    Args:
        raw: The raw subject name from user input or import

    Returns:
        str: Canonical subject name, or original if no mapping exists
    """
    if not raw:
        return raw
    return SUBJECT_ALIASES.get(raw.strip().upper(), raw.strip())


# ---------------------------------------------------------------------------
# Teacher Model
# ---------------------------------------------------------------------------

class TeacherBase(SQLModel):
    """
    Base model containing shared teacher attributes.

    This is used as the foundation for:
    - Teacher: The database table model
    - TeacherCreate: The API input schema
    - TeacherRead: The API response schema

    All fields are optional except full_name and region to allow
    partial data from various import sources.
    """
    full_name: str
    region: str
    province: Optional[str] = None    # ← new
    city: Optional[str] = None        # ← new
    division: Optional[str] = None
    school_name: Optional[str] = None
    school_type: Optional[str] = None
    position: Optional[str] = None
    years_experience: Optional[int] = None
    highest_qualification: Optional[str] = None
    subject_specializations: Optional[str] = None
    grade_levels_taught: Optional[str] = None
    low_confidence_subjects: Optional[str] = None
    unapplied_modules: Optional[str] = None
    distance_to_training: Optional[str] = None
    preferred_format: Optional[str] = None
    source: str = "self-registry"
    data_confidence: float = 1.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None             # Last update timestamp


class Teacher(TeacherBase, table=True):
    """
    Teacher database model (the actual table).

    Represents a science or mathematics teacher in the STAR program database.
    Each teacher can have multiple training records (one-to-many relationship).
    """
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    trainings: List["TrainingRecord"] = Relationship(back_populates="teacher")


class TeacherCreate(TeacherBase):
    """
    Schema for creating a new teacher via API.

    Extends TeacherBase with list fields that will be converted to JSON
    strings before database storage. This allows the frontend to send
    arrays directly without worrying about JSON serialization.
    """
    source: str = "self-registry"
    data_confidence: float = 1.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    subject_specializations: Optional[List[str]] = []
    grade_levels_taught: Optional[List[str]] = []
    low_confidence_subjects: Optional[List[str]] = []
    unapplied_modules: Optional[List[str]] = []
    trainings_attended: Optional[List[str]] = []
    province: Optional[str] = None    # ← new
    city: Optional[str] = None        # ← new


class TeacherRead(TeacherBase):
    """
    Schema for reading teacher data via API.

    Includes the teacher ID and all related training records.
    Used for API responses to include nested training data.
    """
    id: str
    trainings: List["TrainingRecordRead"] = []


# ---------------------------------------------------------------------------
# Training Record Model
# ---------------------------------------------------------------------------

class TrainingRecordBase(SQLModel):
    """
    Base model for training records.

    Tracks when and where a teacher completed a STAR module.
    Training records can cascade (one teacher training others).
    """
    module_name: str                                 # Name of STAR module completed
    year: Optional[int] = None                       # Year of training
    school_year: Optional[str] = None               # School year (e.g., "2023-2024")
    partner_university: Optional[str] = None         # TEI that conducted the training
    region: Optional[str] = None                     # Region where training occurred
    cascaded_to_others: Optional[bool] = False       # Whether teacher trained others
    cascade_from_teacher_id: Optional[str] = None   # ID of cascading teacher (if applicable)
    source: str = "self-registry"                   # Data source
    data_confidence: float = 1.0                    # Confidence score


class TrainingRecord(TrainingRecordBase, table=True):
    """
    Training record database model (the actual table).

    Represents a single STAR module completion for a teacher.
    Multiple training records can belong to one teacher.
    """
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    teacher_id: Optional[str] = Field(default=None, foreign_key="teacher.id")
    teacher: Optional[Teacher] = Relationship(back_populates="trainings")


class TrainingRecordRead(TrainingRecordBase):
    """
    Schema for reading training records via API.
    """
    id: str
    teacher_id: Optional[str]


# ---------------------------------------------------------------------------
# Import Log Model
# ---------------------------------------------------------------------------

class ImportLog(SQLModel, table=True):
    """
    Audit trail for data imports.

    Every bulk import (SF7 or training log) creates a record here
    for tracking purposes and troubleshooting.
    """
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    filename: str                    # Original file name
    source_type: str                 # "sf7" or "star-log"
    rows_parsed: int = 0             # Number of rows read from file
    rows_imported: int = 0           # Number of rows successfully saved
    rows_flagged: int = 0            # Number of rows with issues (missing data, etc.)
    errors: Optional[str] = None    # Error messages if any
    created_at: Optional[datetime] = None