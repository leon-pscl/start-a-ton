from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import init_db
from app.api import teachers, analytics, imports

app = FastAPI(
    title="STAR Integrated Data System",
    description="DOST-SEI Science Teacher Academy for the Regions — Teacher Profile & Analytics API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(teachers.router)
app.include_router(analytics.router)
app.include_router(imports.router)


@app.get("/")
def root():
    return {
        "system": "STAR Integrated Data System",
        "version": "1.0.0",
        "docs": "/docs",
    }