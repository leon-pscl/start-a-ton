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
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.models.models import CANONICAL_REGIONS, STAR_MODULES, Teacher, TrainingRecord

# Set seed for reproducible results
random.seed(42)


# ---------------------------------------------------------------------------
# Configuration Constants
# ---------------------------------------------------------------------------

POSITIONS = ["Teacher I", "Teacher II", "Teacher III", "Master Teacher I", "Master Teacher II"]
QUALIFICATIONS = ["BSEd", "BSEd", "BSEd", "MEd", "MEd", "PhD"]
SUBJECTS = ["General Science", "Biology", "Chemistry", "Physics", "Earth Science", "Mathematics", "Statistics"]
SCHOOL_TYPES = ["public", "public", "public", "private"]
DISTANCES = ["<1hr", "<1hr", "1-3hrs", "1-3hrs", "3hrs+"]
FORMATS = ["face-to-face", "blended", "online"]

FIRST_NAMES = [
    "Maria", "Jose", "Ana", "Juan", "Rosa", "Pedro", "Luz", "Carlos", "Elena", "Ramon",
    "Cristina", "Eduardo", "Patricia", "Miguel", "Lourdes", "Antonio", "Maricel", "Robert",
]
LAST_NAMES = [
    "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Flores",
    "Villanueva", "Aquino", "Ramos", "Dela Cruz", "Gonzales", "Lopez", "Hernandez",
]


# ---------------------------------------------------------------------------
# Region Data
# ---------------------------------------------------------------------------

PROVINCES = {
    'NCR': ['Metro Manila'],
    'Region I': ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
    'Region II': ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
    'Region III': ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
    'Region IV-A': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
    'Region IV-B': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
    'Region V': ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
    'Region VI': ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
    'Region VII': ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
    'Region VIII': ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
    'Region IX': ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
    'Region X': ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
    'Region XI': ['Compostela Valley', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
    'Region XII': ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
    'Region XIII': ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
    'CAR': ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
    'BARMM': ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
}

CITIES_BY_PROVINCE = {
    # NCR
    'Metro Manila': ['Caloocan City', 'Las Piñas City', 'Makati City', 'Malabon City', 'Mandaluyong City', 'Manila City', 'Marikina City', 'Muntinlupa City', 'Navotas City', 'Pasay City', 'Pasig City', 'Pateros', 'Quezon City', 'San Juan City', 'Taguig City', 'Valenzuela City'],
    # Region I
    'Ilocos Norte': ['Batac City', 'Laoag City'],
    'Ilocos Sur': ['Candon City', 'Vigan City'],
    'La Union': ['San Fernando City'],
    'Pangasinan': ['Dagupan City', 'San Fabian', 'Umingan'],
    # Region II
    'Batanes': ['Basco'],
    'Cagayan': ['Tuguegarao City'],
    'Isabela': ['Cauayan City', 'Ilagan City', 'Santiago City'],
    'Nueva Vizcaya': ['Bayombong'],
    'Quirino': ['Cabarroguis'],
    # Region III
    'Aurora': ['Baler'],
    'Bataan': ['Balanga City', 'Dinalupihan'],
    'Bulacan': ['Malolos City', 'San Jose del Monte City'],
    'Nueva Ecija': ['Cabanatuan City', 'Gapan City', 'Palayan City', 'San Jose City'],
    'Pampanga': ['Angeles City', 'Apalit', 'San Fernando City'],
    'Tarlac': ['Tarlac City'],
    'Zambales': ['Olongapo City', 'Subic'],
    # Region IV-A
    'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City'],
    'Cavite': ['Bacoor City', 'Cavite City', 'Dasmariñas City', 'Imus City', 'Tagaytay City', 'Trece Martires City'],
    'Laguna': ['Biñan City', 'Cabuyao City', 'Calamba City', 'Los Baños', 'San Pablo City', 'Santa Rosa City'],
    'Quezon': ['Lucena City'],
    'Rizal': ['Antipolo City', 'Binangonan', 'Cainta', 'Taytay'],
    # Region IV-B
    'Marinduque': ['Boac'],
    'Occidental Mindoro': ['Mamburao'],
    'Oriental Mindoro': ['Calapan City'],
    'Palawan': ['Puerto Princesa City'],
    'Romblon': ['Romblon'],
    # Region V
    'Albay': ['Legazpi City', 'Tabaco City'],
    'Camarines Norte': ['Daet'],
    'Camarines Sur': ['Iriga City', 'Naga City', 'Pili'],
    'Catanduanes': ['Virac'],
    'Masbate': ['Masbate City'],
    'Sorsogon': ['Sorsogon City'],
    # Region VI
    'Aklan': ['Kalibo'],
    'Antique': ['San José de Buenavista'],
    'Capiz': ['Roxas City'],
    'Guimaras': ['Jordan'],
    'Iloilo': ['Iloilo City', 'Passi City'],
    'Negros Occidental': ['Bacolod City', 'Bago City', 'Cadiz City', 'Escalante City', 'Himamaylan City', 'Kabankalan City', 'La Carlota City', 'La Paz', 'Sagay City', 'San Carlos City', 'Silay City', 'Sipalay City', 'Talisay City', 'Victorias City'],
    # Region VII
    'Bohol': ['Tagbilaran City'],
    'Cebu': ['Cebu City', 'Danao City', 'Lapu-Lapu City', 'Mandaue City', 'Toledo City'],
    'Negros Oriental': ['Bais City', 'Bayawan City', 'Canlaon City', 'Dumaguete City', 'Guihulngan City', 'Tanjay City'],
    'Siquijor': ['Siquijor'],
    # Region VIII
    'Biliran': ['Naval'],
    'Eastern Samar': ['Borongan City'],
    'Leyte': ['Baybay City', 'Ormoc City', 'Tacloban City'],
    'Northern Samar': ['Catarman'],
    'Samar': ['Catbalogan City'],
    'Southern Leyte': ['Maasin City'],
    # Region IX
    'Zamboanga del Norte': ['Dipolog City', 'Koronadal City', 'Pagadian City'],
    'Zamboanga del Sur': ['Zamboanga City'],
    'Zamboanga Sibugay': ['Ipil'],
    # Region X
    'Bukidnon': ['Malaybalay City', 'Valencia City'],
    'Camiguin': ['Mambajao'],
    'Lanao del Norte': ['Iligan City'],
    'Misamis Occidental': ['Oroquieta City', 'Ozamis City', 'Tangub City'],
    'Misamis Oriental': ['Cagayan de Oro City', 'El Salvador City', 'Gingoog City'],
    # Region XI
    'Compostela Valley': ['Compostela', 'Nabunturan'],
    'Davao de Oro': ['Compostela', 'Nabunturan'],
    'Davao del Norte': ['Panabo City', 'Samal City', 'Tagum City'],
    'Davao del Sur': ['Davao City', 'Digos City'],
    'Davao Occidental': ['Malita'],
    'Davao Oriental': ['Mati City'],
    # Region XII
    'Cotabato': ['Kidapawan City'],
    'Sarangani': ['Alabel'],
    'South Cotabato': ['General Santos City', 'Koronadal City', 'Polomolok', 'Santo Niño'],
    'Sultan Kudarat': ['Isulan', 'Tacurong City'],
    # Region XIII
    'Agusan del Norte': ['Butuan City', 'Cabadbaran City'],
    'Agusan del Sur': ['Bayugan City', 'Prosperidad'],
    'Dinagat Islands': ['San José'],
    'Surigao del Norte': ['Surigao City'],
    'Surigao del Sur': ['Bislig City', 'Tandag City'],
    # CAR
    'Abra': ['Bangued'],
    'Apayao': ['Calamayor'],
    'Benguet': ['Baguio City', 'La Trinidad'],
    'Ifugao': ['Lagawe'],
    'Kalinga': ['Tabuk City'],
    'Mountain Province': ['Bontoc'],
    # BARMM
    'Basilan': ['Isabela City'],
    'Lanao del Sur': ['Marawi City'],
    'Maguindanao del Norte': ['Cotabato City'],
    'Maguindanao del Sur': ['Shariff Aguak'],
    'Sulu': ['Jolo'],
    'Tawi-Tawi': ['Bongao'],
}

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


# ---------------------------------------------------------------------------
# Gap Profile Configuration
# ---------------------------------------------------------------------------

GAP_PROFILES = {
    "high": {
        "trained_pct": 0.20,
        "mismatch_pct": 0.50,
        "far_pct": 0.60,
        "count_range": (8, 15),
    },
    "moderate": {
        "trained_pct": 0.50,
        "mismatch_pct": 0.30,
        "far_pct": 0.30,
        "count_range": (12, 25),
    },
    "low": {
        "trained_pct": 0.80,
        "mismatch_pct": 0.10,
        "far_pct": 0.10,
        "count_range": (15, 35),
    },
}

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

def make_name() -> str:
    """Generate a random Filipino name from common first and last names."""
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


# ---------------------------------------------------------------------------
# Main Seed Function
# ---------------------------------------------------------------------------

def _make_teacher(session, region, province, city, profile):
    """Create a single teacher record with randomized attributes."""
    specs   = random.sample(SUBJECTS, k=random.randint(1, 3))
    low_conf = random.sample(SUBJECTS, k=random.randint(0, 2))
    is_far      = random.random() < profile["far_pct"]
    is_mismatch = random.random() < profile["mismatch_pct"]

    # subjects_currently_teaching: if mismatched, teacher teaches at least one
    # subject OUTSIDE their specialization; otherwise they teach only within spec
    if is_mismatch:
        outside = random.sample([s for s in SUBJECTS if s not in specs], k=1)
        currently_teaching = random.sample(specs, k=random.randint(1, len(specs))) + outside
    else:
        currently_teaching = random.sample(specs, k=random.randint(1, len(specs)))

    teacher = Teacher(
        full_name=make_name(),
        region=region,
        province=province,
        city=city,
        division=f"{region} Division {random.randint(1, 3)}",
        school_name=f"{random.choice(['National', 'Integrated', 'Central'])} High School",
        school_type=random.choice(SCHOOL_TYPES),
        position=random.choice(POSITIONS),
        years_experience=random.randint(1, 30),
        highest_qualification=random.choice(QUALIFICATIONS),
        subject_specializations=json.dumps(specs),
        subjects_currently_teaching=json.dumps(currently_teaching),
        grade_levels_taught=json.dumps(random.sample(
            ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
            k=random.randint(1, 4)
        )),
        low_confidence_subjects=json.dumps(low_conf),
        unapplied_modules=json.dumps(random.sample(STAR_MODULES, k=random.randint(0, 3))),
        distance_to_training=("3hrs+" if is_far else random.choice(["<1hr", "1-3hrs"])),
        preferred_format=random.choice(FORMATS),
        source="seed",
        data_confidence=0.9,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(teacher)
    session.flush()
    return teacher


def seed():
    """
    Populate the database with mock data.

    Creates teachers and training records for all 17 STAR regions,
    distributing them across cities (at least 3 per city) with
    characteristics matching the gap profiles defined above.
    """
    # Don't overwrite existing database
    if os.path.exists("star.db"):
        print("star.db already exists. Skipping seed.")
        return

    # Initialize database schema
    init_db()

    MIN_PER_CITY = 3  # minimum teachers guaranteed per city

    with Session(engine) as session:
        all_teachers = []

        # Generate teachers for each region
        for region in CANONICAL_REGIONS:
            profile_key = REGION_GAP.get(region, "moderate")
            profile = GAP_PROFILES[profile_key]
            target_count = random.randint(*profile["count_range"])
            partner_uni = PARTNER_UNIVERSITIES.get(region, "State University")

            # Collect all (province, city) pairs for this region
            region_cities = []
            for province in PROVINCES.get(region, []):
                for city in CITIES_BY_PROVINCE.get(province, []):
                    region_cities.append((province, city))

            if not region_cities:
                continue

            num_cities = len(region_cities)
            min_total = MIN_PER_CITY * num_cities

            # Guarantee at least MIN_PER_CITY per city; distribute remainder randomly
            if target_count <= min_total:
                counts = [MIN_PER_CITY] * num_cities
            else:
                extras = target_count - min_total
                counts = [MIN_PER_CITY] * num_cities
                for _ in range(extras):
                    counts[random.randint(0, num_cities - 1)] += 1
                # Shuffle so adjacent cities don't all get +1
                order = list(range(num_cities))
                random.shuffle(order)
                counts = [counts[order[i]] for i in range(num_cities)]

            for i, (province, city) in enumerate(region_cities):
                for _ in range(counts[i]):
                    teacher = _make_teacher(session, region, province, city, profile)
                    all_teachers.append((teacher, region, partner_uni, profile["trained_pct"]))

        # Create training records based on trained percentage
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

        total = session.exec(select(Teacher)).all()
        print(f"Seeded {len(total)} teachers across {len(CANONICAL_REGIONS)} regions.")


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    seed()