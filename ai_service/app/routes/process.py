from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os

from app.core.video_processor import VideoProcessor
from app.core.face_identifier import generate_face_encoding

router = APIRouter()

processing_jobs: dict = {}


# ── Request schemas ────────────────────────────────────────

class RegisteredStudent(BaseModel):
    _id: str
    name: str
    prn: str
    className: Optional[str] = ''
    faceEncoding: Optional[List[float]] = None


class ProcessVideoRequest(BaseModel):
    session_id: str
    video_path: str
    engagement_threshold: float = 70.0
    frame_score_threshold: float = 0.6
    processing_fps: int = 5
    registered_students: Optional[List[dict]] = []  # Sent by Node.js


class EncodeFaceRequest(BaseModel):
    student_id: str
    photo_path: str


# ── POST /api/ai/process ───────────────────────────────────
@router.post("/process")
async def process_video(request: ProcessVideoRequest):
    """Process classroom video with face recognition."""

    if not os.path.exists(request.video_path):
        raise HTTPException(status_code=404, detail=f"Video not found: {request.video_path}")

    processing_jobs[request.session_id] = {'status': 'processing', 'progress': 0}

    try:
        processor = VideoProcessor(
            processing_fps=request.processing_fps,
            frame_score_threshold=request.frame_score_threshold,
            engagement_threshold=request.engagement_threshold,
        )

        # Load registered students for face recognition
        if request.registered_students:
            processor.load_registered_students(request.registered_students)
            print(f"👥 Loaded {len(request.registered_students)} students for session {request.session_id}")

        def on_progress(progress, students_found):
            processing_jobs[request.session_id]['progress'] = progress

        results = processor.process(
            video_path=request.video_path,
            on_progress=on_progress,
        )

        processing_jobs[request.session_id]['status'] = 'completed'

        return {
            'success': True,
            'message': f"Done. Found {len(results['students'])} students.",
            'results': results,
        }

    except Exception as e:
        processing_jobs[request.session_id]['status'] = 'failed'
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/ai/encode-face ───────────────────────────────
@router.post("/encode-face")
async def encode_face(request: EncodeFaceRequest):
    """
    Generate face encoding for a registered student photo.
    Called by Node.js after teacher uploads student photo.
    """
    if not os.path.exists(request.photo_path):
        raise HTTPException(status_code=404, detail=f"Photo not found: {request.photo_path}")

    encoding = generate_face_encoding(request.photo_path)

    if encoding is None:
        return {
            'success': False,
            'message': 'No face detected in photo. Please upload a clearer photo.',
        }

    return {
        'success':  True,
        'message':  'Face encoding generated successfully.',
        'encoding': encoding,
    }


# ── GET /api/ai/health ─────────────────────────────────────
@router.get("/health")
async def health():
    return {'status': 'ok', 'message': 'AI service is running'}


# ── GET /api/ai/status/:id ─────────────────────────────────
@router.get("/status/{session_id}")
async def get_status(session_id: str):
    if session_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return processing_jobs[session_id]
