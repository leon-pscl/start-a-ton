"""
Run: python seed.py
Populates the database with realistic mock data across all 17 STAR regions.
"""
import json
import random
from datetime import datetime
from sqlmodel import Session
from app.core.database import engine, init_db
from app.models.models import Teacher, TrainingRecord, CANONICAL_REGIONS, STAR_MODULES

random.seed(42)

POSITIONS = ["Teacher I", "Teacher II", "Teacher III", "Master Teacher I", "Master Teacher II"]
QUALIFICATIONS = ["BSEd", "BSEd", "BSEd", "MEd", "MEd", "PhD"]
SUBJECTS = ["General Science", "Biology", "Chemistry", "Physics", "Earth Science", "Mathematics", "Statistics"]
SCHOOL_TYPES = ["public", "public", "public", "private"]
DISTANCES = ["<1hr", "<1hr", "1-3hrs", "1-3hrs", "3hrs+"]
FORMATS = ["face-to-face", "blended", "online"]
PARTNER_UNIVERSITIES = {
    "CAR": "Saint Louis University",
    "Region I": "Mariano Marcos State University",
    "Region II": "Saint Mary's University",
    "Region III": "Central Luzon State University",
    "Region IV-A": "Batangas State University",
    "Region IV-B": "Palawan State University",
    "NCR": "Philippine Normal University",
    "Region V": "Bicol University",
    "Region VI": "West Visayas State University",
    "Region VII": "Cebu Normal University",
    "Region VIII": "Leyte Normal University",
    "Region IX": "Ateneo De Zamboanga University",
    "Region X": "Mindanao State University-IIT",
    "Region XI": "University of Southeastern Philippines",
    "Region XII": "University of Southern Mindanao",
    "Region XIII": "Caraga State University",
    "BARMM": "Mindanao State University Marawi",
}

FIRST_NAMES = ["Maria", "Jose", "Ana", "Juan", "Rosa", "Pedro", "Luz", "Carlos", "Elena", "Ramon",
               "Cristina", "Eduardo", "Patricia", "Miguel", "Lourdes", "Antonio", "Maricel", "Robert"]
LAST_NAMES = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Flores",
              "Villanueva", "Aquino", "Ramos", "Dela Cruz", "Gonzales", "Lopez", "Hernandez"]

GAP_PROFILES = {
    "high":     {"trained_pct": 0.20, "mismatch_pct": 0.50, "far_pct": 0.60, "count_range": (8, 15)},
    "moderate": {"trained_pct": 0.50, "mismatch_pct": 0.30, "far_pct": 0.30, "count_range": (12, 25)},
    "low":      {"trained_pct": 0.80, "mismatch_pct": 0.10, "far_pct": 0.10, "count_range": (15, 35)},
}

# Assign gap profiles to regions for realistic variation
REGION_GAP = {
    "BARMM": "high", "Region IX": "high", "Region VIII": "high", "Region IV-B": "high",
    "Region XIII": "moderate", "Region V": "moderate", "Region XII": "moderate",
    "Region II": "moderate", "CAR": "moderate", "Region X": "moderate",
    "NCR": "low", "Region IV-A": "low", "Region III": "low",
    "Region VII": "low", "Region VI": "low", "Region I": "low", "Region XI": "low",
}


def make_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def seed():
    init_db()
    with Session(engine) as session:
        all_teachers = []
        for region in CANONICAL_REGIONS:
            profile_key = REGION_GAP.get(region, "moderate")
            profile = GAP_PROFILES[profile_key]
            count = random.randint(*profile["count_range"])
            partner_uni = PARTNER_UNIVERSITIES.get(region, "State University")

            for _ in range(count):
                specs = random.sample(SUBJECTS, k=random.randint(1, 3))
                low_conf = random.sample(SUBJECTS, k=random.randint(0, 2))
                is_far = random.random() < profile["far_pct"]
                is_mismatch = random.random() < profile["mismatch_pct"]

                teacher = Teacher(
                    full_name=make_name(),
                    region=region,
                    division=f"{region} Division {random.randint(1, 3)}",
                    school_name=f"{random.choice(['National', 'Integrated', 'Central'])} High School",
                    school_type=random.choice(SCHOOL_TYPES),
                    position=random.choice(POSITIONS),
                    years_experience=random.randint(1, 30),
                    highest_qualification=random.choice(QUALIFICATIONS),
                    subject_specializations=json.dumps(specs),
                    grade_levels_taught=json.dumps(random.sample(
                        ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
                        k=random.randint(1, 4)
                    )),
                    low_confidence_subjects=json.dumps(low_conf if is_mismatch else []),
                    unapplied_modules=json.dumps(random.sample(STAR_MODULES, k=random.randint(0, 3))),
                    distance_to_training=("3hrs+" if is_far else random.choice(["<1hr", "1-3hrs"])),
                    preferred_format=random.choice(FORMATS),
                    source="seed",
                    data_confidence=0.9,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                session.add(teacher)
                session.flush()
                all_teachers.append((teacher, region, partner_uni, profile["trained_pct"]))

        for teacher, region, partner_uni, trained_pct in all_teachers:
            if random.random() < trained_pct:
                num_modules = random.randint(1, 4)
                modules = random.sample(STAR_MODULES, k=num_modules)
                for module in modules:
                    year = random.randint(2019, 2024)
                    tr = TrainingRecord(
                        teacher_id=teacher.id,
                        module_name=module,
                        year=year,
                        school_year=f"{year}-{year+1}",
                        partner_university=partner_uni,
                        region=region,
                        cascaded_to_others=random.random() < 0.3,
                        source="seed",
                        data_confidence=0.9,
                    )
                    session.add(tr)

        session.commit()
        total = session.exec(
            __import__("sqlmodel", fromlist=["select"]).select(Teacher)
        ).all()
        print(f"Seeded {len(total)} teachers across {len(CANONICAL_REGIONS)} regions.")


if __name__ == "__main__":
    seed()