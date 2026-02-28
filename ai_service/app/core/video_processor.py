import cv2
import mediapipe as mp
import numpy as np
from typing import Callable, Optional

from .tracker import StudentTracker
from .eye_state import calculate_eye_open_score
from .head_pose import calculate_head_pose_score
from .gaze import calculate_gaze_score
from .engagement import calculate_frame_score, calculate_body_orientation


# ─────────────────────────────────────────────────────────────
#  Video Processor
#  The main orchestrator — ties together all AI components.
#
#  Processing pipeline per frame:
#    1. Read frame from video
#    2. Detect all faces with MediaPipe
#    3. For each detected face:
#       a. Calculate gaze score
#       b. Calculate head pose score
#       c. Calculate eye open score
#       d. Calculate face visibility score
#       e. Calculate body orientation score
#       f. Calculate weighted frame score
#    4. Pass detections to tracker (assigns persistent IDs)
#    5. Report progress every 5%
#
#  After all frames:
#    6. Calculate final engagement scores per student
#    7. Determine attendance status
#    8. Return results to Node.js
# ─────────────────────────────────────────────────────────────


class VideoProcessor:
    def __init__(
        self,
        processing_fps: int = 5,
        frame_score_threshold: float = 0.6,
        engagement_threshold: float = 70.0,
    ):
        self.processing_fps = processing_fps
        self.frame_score_threshold = frame_score_threshold
        self.engagement_threshold = engagement_threshold

        # Initialize MediaPipe Face Mesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,        # Video mode — uses tracking internally
            max_num_faces=50,               # Support up to 50 students per frame
            refine_landmarks=True,          # Include iris landmarks (needed for gaze)
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def process(
        self,
        video_path: str,
        on_progress: Optional[Callable] = None,
    ) -> dict:
        """
        Process a video file and return engagement results.

        Args:
            video_path: absolute path to the video file
            on_progress: optional callback(progress_percent, students_found)

        Returns:
            {
                'students': [...],
                'video_duration_sec': float,
                'total_frames_processed': int,
                'processing_fps': int,
            }
        """
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")

        # ── Video metadata ─────────────────────────────────────
        video_fps          = cap.get(cv2.CAP_PROP_FPS) or 30
        total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_duration_sec = total_video_frames / video_fps

        # How many video frames to skip between each processed frame
        # e.g. video at 30fps, processing at 5fps → skip every 6 frames
        frame_skip = max(1, int(video_fps / self.processing_fps))

        # ── Initialize tracker ─────────────────────────────────
        tracker = StudentTracker()
        tracker.frame_sample_rate = max(1, self.processing_fps * 2)  # Sample every 2 seconds

        frame_idx         = 0    # Total frames read from video
        processed_count   = 0    # Frames we actually analyzed
        last_progress     = -1   # Track last reported progress

        print(f"📹 Video: {video_duration_sec:.1f}s, {video_fps:.0f}fps, {total_video_frames} frames")
        print(f"⚙️  Processing at {self.processing_fps}fps (analyzing every {frame_skip} frames)")

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1

                # Skip frames to match desired processing FPS
                if frame_idx % frame_skip != 0:
                    continue

                # ── Process this frame ─────────────────────────
                timestamp_sec = frame_idx / video_fps
                detections = self._process_frame(frame, processed_count, timestamp_sec)

                tracker.update(
                    frame_no=processed_count,
                    timestamp_sec=timestamp_sec,
                    detections=detections,
                    frame_score_threshold=self.frame_score_threshold,
                )

                processed_count += 1

                # ── Report progress every 5% ───────────────────
                progress = int((frame_idx / total_video_frames) * 100)
                if progress != last_progress and progress % 5 == 0:
                    last_progress = progress
                    students_found = len([
                        t for t in tracker.tracks.values()
                        if t.total_frames >= 5
                    ])
                    print(f"   Progress: {progress}% | Students found: {students_found}")
                    if on_progress:
                        on_progress(progress, students_found)

        finally:
            cap.release()
            self.face_mesh.close()

        # ── Get final results ──────────────────────────────────
        students = tracker.get_results(self.engagement_threshold)

        print(f"✅ Processing complete: {len(students)} students, {processed_count} frames analyzed")

        return {
            'students':               students,
            'video_duration_sec':     round(video_duration_sec, 2),
            'total_frames_processed': processed_count,
            'processing_fps':         self.processing_fps,
        }

    def _process_frame(self, frame, frame_no: int, timestamp_sec: float) -> list:
        """
        Detect all faces in one frame and calculate engagement signals.

        Returns:
            List of (bbox, signals_dict, frame_score) for each detected face
        """
        h, w = frame.shape[:2]

        # Convert BGR (OpenCV) to RGB (MediaPipe requirement)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            return []

        detections = []

        for face_landmarks in results.multi_face_landmarks:
            try:
                # ── Calculate bounding box ─────────────────────
                x_coords = [lm.x for lm in face_landmarks.landmark]
                y_coords = [lm.y for lm in face_landmarks.landmark]
                bbox = (
                    max(0.0, min(x_coords) - 0.02),
                    max(0.0, min(y_coords) - 0.02),
                    min(1.0, max(x_coords) + 0.02),
                    min(1.0, max(y_coords) + 0.02),
                )

                # ── Calculate face visibility score ────────────
                # Use landmark detection confidence as proxy
                # A fully visible face has tightly packed landmarks
                face_width  = max(x_coords) - min(x_coords)
                face_height = max(y_coords) - min(y_coords)
                face_area   = face_width * face_height
                # Normalize: typical face area in classroom ≈ 0.01 - 0.05
                face_visible_score = min(1.0, max(0.0, face_area / 0.04))

                # ── Calculate all 5 engagement signals ─────────
                signals = {
                    'gaze':         calculate_gaze_score(face_landmarks, w, h),
                    'head_pose':    calculate_head_pose_score(face_landmarks, w, h),
                    'eye_open':     calculate_eye_open_score(face_landmarks, w, h),
                    'face_visible': face_visible_score,
                    'body_orient':  calculate_body_orientation(face_landmarks, w, h),
                }

                # ── Calculate weighted frame score ─────────────
                frame_score = calculate_frame_score(signals)

                detections.append((bbox, signals, frame_score))

            except Exception as e:
                # Skip this face if any calculation fails
                continue

        return detections
