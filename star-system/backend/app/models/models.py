from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid


def gen_uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Controlled vocabulary tables
# ---------------------------------------------------------------------------

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

SUBJECT_ALIASES = {
    "SCIENCE": "General Science", "SCI": "General Science", "GENERAL SCIENCE": "General Science",
    "BIOLOGY": "Biology", "BIO": "Biology", "EARTH AND LIFE SCIENCE": "Biology",
    "CHEMISTRY": "Chemistry", "CHEM": "Chemistry",
    "PHYSICS": "Physics", "PHY": "Physics",
    "EARTH SCIENCE": "Earth Science", "EARTH SCI": "Earth Science",
    "MATHEMATICS": "Mathematics", "MATH": "Mathematics", "MTH": "Mathematics",
    "STATISTICS": "Statistics", "STAT": "Statistics",
}

STAR_MODULES = [
    "Teaching Mathematics through Problem Solving",
    "Inquiry-based Approach for Teaching Science",
    "Interdisciplinary Contextualization",
    "Language Strategies for Teaching Science and Mathematics",
    "Design Thinking for K-3 Science and Mathematics",
    "Designing Assessment Activities for Blended Learning",
    "Instrumentation and Improvisation",
]

CANONICAL_REGIONS = sorted(set(REGION_ALIASES.values()))


def normalize_region(raw: str) -> str:
    if not raw:
        return "Unknown"
    return REGION_ALIASES.get(raw.strip().upper(), raw.strip())


def normalize_subject(raw: str) -> str:
    if not raw:
        return raw
    return SUBJECT_ALIASES.get(raw.strip().upper(), raw.strip())


# ---------------------------------------------------------------------------
# DB Models
# ---------------------------------------------------------------------------

class TeacherBase(SQLModel):
    full_name: str
    region: str
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
    updated_at: Optional[datetime] = None


class Teacher(TeacherBase, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    trainings: List["TrainingRecord"] = Relationship(back_populates="teacher")


class TeacherCreate(TeacherBase):
    source: str = "self-registry"
    data_confidence: float = 1.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Accept lists from frontend — teachers.py will json.dumps() them before saving
    subject_specializations: Optional[List[str]] = []
    grade_levels_taught: Optional[List[str]] = []
    low_confidence_subjects: Optional[List[str]] = []
    unapplied_modules: Optional[List[str]] = []
    trainings_attended: Optional[List[str]] = []


class TeacherRead(TeacherBase):
    id: str
    trainings: List["TrainingRecordRead"] = []


class TrainingRecordBase(SQLModel):
    module_name: str
    year: Optional[int] = None
    school_year: Optional[str] = None
    partner_university: Optional[str] = None
    region: Optional[str] = None
    cascaded_to_others: Optional[bool] = False
    cascade_from_teacher_id: Optional[str] = None
    source: str = "self-registry"
    data_confidence: float = 1.0


class TrainingRecord(TrainingRecordBase, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    teacher_id: Optional[str] = Field(default=None, foreign_key="teacher.id")
    teacher: Optional[Teacher] = Relationship(back_populates="trainings")


class TrainingRecordRead(TrainingRecordBase):
    id: str
    teacher_id: Optional[str]


class ImportLog(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    filename: str
    source_type: str
    rows_parsed: int = 0
    rows_imported: int = 0
    rows_flagged: int = 0
    errors: Optional[str] = None
    created_at: Optional[datetime] = None