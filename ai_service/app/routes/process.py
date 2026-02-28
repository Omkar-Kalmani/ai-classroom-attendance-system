from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.models.schemas import ProcessVideoRequest, ProcessVideoResponse
from app.core.video_processor import VideoProcessor
import os

router = APIRouter()

# ─────────────────────────────────────────────────────────────
#  In-memory job status store
#  Tracks processing status for each session.
#  In production, use Redis for this.
# ─────────────────────────────────────────────────────────────
processing_jobs: dict = {}


# ─────────────────────────────────────────────────────────────
#  POST /api/ai/process
#  Called by Node.js to start video processing.
#  Runs synchronously (Node.js already handles async via background).
# ─────────────────────────────────────────────────────────────
@router.post("/process", response_model=ProcessVideoResponse)
async def process_video(request: ProcessVideoRequest):
    """
    Process a classroom video and return engagement results.

    Node.js sends:
        - session_id: MongoDB session ID
        - video_path: absolute path to video on shared filesystem
        - engagement_threshold: score to mark PRESENT (default 70)
        - frame_score_threshold: per-frame attentive threshold (default 0.6)
        - processing_fps: frames to analyze per second (default 5)

    Returns:
        - success: bool
        - results: StudentResult list + video metadata
    """
    # ── Validate video file exists ─────────────────────────
    if not os.path.exists(request.video_path):
        raise HTTPException(
            status_code=404,
            detail=f"Video file not found: {request.video_path}"
        )

    # ── Mark job as processing ─────────────────────────────
    processing_jobs[request.session_id] = {
        'status': 'processing',
        'progress': 0,
        'students_found': 0,
    }

    try:
        # ── Initialize processor ───────────────────────────
        processor = VideoProcessor(
            processing_fps=request.processing_fps,
            frame_score_threshold=request.frame_score_threshold,
            engagement_threshold=request.engagement_threshold,
        )

        # ── Progress callback ──────────────────────────────
        def on_progress(progress: int, students_found: int):
            processing_jobs[request.session_id]['progress'] = progress
            processing_jobs[request.session_id]['students_found'] = students_found

        # ── Run processing ─────────────────────────────────
        results = processor.process(
            video_path=request.video_path,
            on_progress=on_progress,
        )

        # ── Mark job as complete ───────────────────────────
        processing_jobs[request.session_id]['status'] = 'completed'
        processing_jobs[request.session_id]['progress'] = 100

        return ProcessVideoResponse(
            success=True,
            message=f"Processing complete. Found {len(results['students'])} students.",
            results=results,
        )

    except Exception as e:
        processing_jobs[request.session_id]['status'] = 'failed'
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  GET /api/ai/status/{session_id}
#  Node.js can poll this to get processing progress
#  (fallback if Socket.IO isn't used)
# ─────────────────────────────────────────────────────────────
@router.get("/status/{session_id}")
async def get_status(session_id: str):
    if session_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return processing_jobs[session_id]
