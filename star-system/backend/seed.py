"""
Database Seed Script

Populates the database with mock data for development and testing.
This script creates sample teachers across all 17 STAR regions with varied profiles
to simulate the production data distribution.

Run: python seed.py

The seed creates:
- Teachers with varied experience, positions, and qualifications
- Regional distribution matching real-world population patterns
- Training records with varying completion rates by region
- Gap score profiles (high, moderate, low) to test the analytics

Only runs if star.db doesn't exist (doesn't overwrite existing data).
"""

import json
import os
import random
from datetime import datetime
from sqlmodel import Session
from app.core.database import engine, init_db
from app.models.models import Teacher, TrainingRecord, CANONICAL_REGIONS, STAR_MODULES

# Set seed for reproducible results
random.seed(42)


# ---------------------------------------------------------------------------
# Mock Data Constants
# ---------------------------------------------------------------------------

# Teaching positions in Philippine public schools
POSITIONS = ["Teacher I", "Teacher II", "Teacher III", "Master Teacher I", "Master Teacher II"]

# Educational qualifications (weighted toward common degrees)
QUALIFICATIONS = ["BSEd", "BSEd", "BSEd", "MEd", "MEd", "PhD"]

# Subject areas taught in STAR program
SUBJECTS = ["General Science", "Biology", "Chemistry", "Physics", "Earth Science", "Mathematics", "Statistics"]

# School types (public schools are more common)
SCHOOL_TYPES = ["public", "public", "public", "private"]

# Distance to training centers
DISTANCES = ["<1hr", "<1hr", "1-3hrs", "1-3hrs", "3hrs+"]

# Preferred training formats
FORMATS = ["face-to-face", "blended", "online"]

# Partner universities by region (for training records)
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

# Sample Filipino names for mock data
FIRST_NAMES = ["Maria", "Jose", "Ana", "Juan", "Rosa", "Pedro", "Luz", "Carlos", "Elena", "Ramon",
               "Cristina", "Eduardo", "Patricia", "Miguel", "Lourdes", "Antonio", "Maricel", "Robert"]
LAST_NAMES = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Flores",
              "Villanueva", "Aquino", "Ramos", "Dela Cruz", "Gonzales", "Lopez", "Hernandez"]


# ---------------------------------------------------------------------------
# Gap Profile Configuration
# ---------------------------------------------------------------------------

# Profiles for simulating different regional gap levels
# These control the distribution of teacher characteristics by region
GAP_PROFILES = {
    "high": {
        "trained_pct": 0.20,      # Only 20% trained
        "mismatch_pct": 0.50,     # 50% teaching outside specialization
        "far_pct": 0.60,          # 60% far from training centers
        "count_range": (8, 15),   # Number of teachers to generate
    },
    "moderate": {
        "trained_pct": 0.50,
        "mismatch_pct": 0.30,
        "far_pct": 0.30,
        "count_range": (12, 25),
    },
    "low": {
        "trained_pct": 0.80,      # 80% trained
        "mismatch_pct": 0.10,      # Only 10% mismatch
        "far_pct": 0.10,          # Most are near training centers
        "count_range": (15, 35),
    },
}

# Region-to-gap-level mapping for realistic distribution
# Based on actual STAR program coverage and regional development data
REGION_GAP = {
    "BARMM": "high", "Region IX": "high", "Region VIII": "high", "Region IV-B": "high",
    "Region XIII": "moderate", "Region V": "moderate", "Region XII": "moderate",
    "Region II": "moderate", "CAR": "moderate", "Region X": "moderate",
    "NCR": "low", "Region IV-A": "low", "Region III": "low",
    "Region VII": "low", "Region VI": "low", "Region I": "low", "Region XI": "low",
}


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def make_name():
    """Generate a random Filipino name from common first and last names."""
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


# ---------------------------------------------------------------------------
# Main Seed Function
# ---------------------------------------------------------------------------

def seed():
    """
    Populate the database with mock data.

    Creates teachers and training records for all 17 STAR regions
    with characteristics matching the gap profiles defined above.
    """
    # Don't overwrite existing database
    if os.path.exists("star.db"):
        print("star.db already exists. Skipping seed.")
        return

    # Initialize database schema
    init_db()

    with Session(engine) as session:
        all_teachers = []

        # Generate teachers for each region
        for region in CANONICAL_REGIONS:
            # Get the gap profile for this region
            profile_key = REGION_GAP.get(region, "moderate")
            profile = GAP_PROFILES[profile_key]
            count = random.randint(*profile["count_range"])
            partner_uni = PARTNER_UNIVERSITIES.get(region, "State University")

            for _ in range(count):
                # Randomly select subjects and other attributes
                specs = random.sample(SUBJECTS, k=random.randint(1, 3))
                low_conf = random.sample(SUBJECTS, k=random.randint(0, 2))
                is_far = random.random() < profile["far_pct"]
                is_mismatch = random.random() < profile["mismatch_pct"]

                # Create teacher record
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
                    data_confidence=0.9,   # Seed data has high confidence
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                session.add(teacher)
                session.flush()  # Get teacher ID
                all_teachers.append((teacher, region, partner_uni, profile["trained_pct"]))

        # Create training records based on trained percentage
        for teacher, region, partner_uni, trained_pct in all_teachers:
            if random.random() < trained_pct:
                # Teacher has some training - create 1-4 module completions
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
                        cascaded_to_others=random.random() < 0.3,   # 30% cascaded
                        source="seed",
                        data_confidence=0.9,
                    )
                    session.add(tr)

        session.commit()

        # Print summary
        total = session.exec(
            __import__("sqlmodel", fromlist=["select"]).select(Teacher)
        ).all()
        print(f"Seeded {len(total)} teachers across {len(CANONICAL_REGIONS)} regions.")


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    seed()