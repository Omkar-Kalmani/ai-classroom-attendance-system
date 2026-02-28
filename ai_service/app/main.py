from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routes.process import router as process_router

# Load environment variables
load_dotenv()

# ─────────────────────────────────────────────────────────────
#  FastAPI Application
#  This is the Python AI microservice.
#  It only does one thing: process videos and return results.
#  All web/auth/DB logic stays in Node.js.
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Classroom Attendance AI Service",
    description="Analyzes classroom videos to calculate student engagement using MediaPipe",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────
# Only allow requests from the Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("NODE_BACKEND_URL", "http://localhost:5000"),
        "http://localhost:5000",
        "http://backend:5000",      # Docker service name
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────
app.include_router(process_router, prefix="/api/ai", tags=["AI Processing"])

# ── Health Check ───────────────────────────────────────────
@app.get("/api/ai/health", tags=["Health"])
async def health_check():
    """
    Called by Node.js on startup to verify AI service is running.
    Also useful for Docker health checks.
    """
    return {
        "status": "ok",
        "message": "AI service is running",
        "processing_fps": int(os.getenv("PROCESSING_FPS", 5)),
        "frame_score_threshold": float(os.getenv("FRAME_SCORE_THRESHOLD", 0.6)),
        "engagement_threshold": float(os.getenv("ENGAGEMENT_THRESHOLD", 70)),
    }

@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Classroom Attendance AI",
        "docs": "/docs",
        "health": "/api/ai/health",
    }
