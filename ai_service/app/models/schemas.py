from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ─────────────────────────────────────────────────────────────
#  Request Schemas — what Node.js sends to us
# ─────────────────────────────────────────────────────────────

class ProcessVideoRequest(BaseModel):
    """
    Sent by Node.js to start processing a video.
    """
    session_id: str = Field(..., description="MongoDB session ID")
    video_path: str = Field(..., description="Absolute path to video file on disk")
    engagement_threshold: float = Field(default=70.0, ge=0, le=100)
    frame_score_threshold: float = Field(default=0.6, ge=0, le=1)
    processing_fps: int = Field(default=5, ge=1, le=30)


# ─────────────────────────────────────────────────────────────
#  Internal Data Schemas — used within the AI pipeline
# ─────────────────────────────────────────────────────────────

class SignalScores(BaseModel):
    """
    The 5 engagement signals scored per frame per student.
    Each score is 0.0 to 1.0.
    """
    gaze: float = 0.0           # Eye gaze direction (weight: 35%)
    head_pose: float = 0.0      # Head orientation (weight: 30%)
    eye_open: float = 0.0       # Eye aspect ratio (weight: 20%)
    face_visible: float = 0.0   # Face detection confidence (weight: 10%)
    body_orient: float = 0.0    # Body/shoulder orientation (weight: 5%)


class FrameEntry(BaseModel):
    """
    Engagement data for one frame for one student.
    Stored in frameTimeline in MongoDB.
    """
    frame_no: int
    timestamp_sec: float
    frame_score: float          # Weighted score 0.0 - 1.0
    is_attentive: bool          # True if frame_score >= threshold


class StudentResult(BaseModel):
    """
    Final result for one tracked student after full video processing.
    Matches the Student MongoDB schema exactly.
    """
    track_id: int
    label: str
    total_frames: int
    attentive_frames: int
    engagement_score: float     # 0 - 100
    attendance_status: str      # "present" or "absent"
    signal_breakdown: dict      # avg of each signal
    frame_timeline: List[dict]  # sampled frame entries


# ─────────────────────────────────────────────────────────────
#  Response Schemas — what we send back to Node.js
# ─────────────────────────────────────────────────────────────

class ProcessingResults(BaseModel):
    students: List[dict]
    video_duration_sec: float
    total_frames_processed: int
    processing_fps: int


class ProcessVideoResponse(BaseModel):
    success: bool
    message: str
    results: Optional[ProcessingResults] = None


class HealthResponse(BaseModel):
    status: str
    message: str
