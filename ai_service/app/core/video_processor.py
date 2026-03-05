import cv2
import mediapipe as mp
import numpy as np
from typing import Callable, Optional, List

from .tracker import StudentTracker
from .eye_state import calculate_eye_open_score
from .head_pose import calculate_head_pose_score
from .gaze import calculate_gaze_score
from .engagement import calculate_frame_score, calculate_body_orientation
from .face_identifier import FaceIdentifier


# ─────────────────────────────────────────────────────────────
#  Updated Video Processor
//  Now includes face recognition to identify students by name/PRN
#
#  Key change from Step 3:
#    Before: each face gets "Student #1", "Student #2" (anonymous)
#    Now:    each face gets matched to registered student database
#            → "Rahul Sharma (PRN: 2021CS001)" if matched
#            → "Unknown #1" if not matched
# ─────────────────────────────────────────────────────────────


class VideoProcessor:
    def __init__(
        self,
        processing_fps: int = 5,
        frame_score_threshold: float = 0.6,
        engagement_threshold: float = 70.0,
    ):
        self.processing_fps        = processing_fps
        self.frame_score_threshold = frame_score_threshold
        self.engagement_threshold  = engagement_threshold

        # MediaPipe Face Mesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=50,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        # Face identifier — loaded with registered students before processing
        self.identifier = FaceIdentifier()

    def load_registered_students(self, students: List[dict]):
        """
        Load registered students before processing video.
        Called by the route handler with data from MongoDB.
        """
        self.identifier.load_students(students)

    def process(
        self,
        video_path: str,
        on_progress: Optional[Callable] = None,
    ) -> dict:
        """
        Process video and return engagement results with student identities.
        """
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")

        video_fps          = cap.get(cv2.CAP_PROP_FPS) or 30
        total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_duration_sec = total_video_frames / video_fps
        frame_skip         = max(1, int(video_fps / self.processing_fps))

        tracker          = StudentTracker()
        tracker.frame_sample_rate = max(1, self.processing_fps * 2)

        frame_idx       = 0
        processed_count = 0
        last_progress   = -1

        # How often to run face recognition (every N processed frames)
        # Running every frame is slow — every 10 frames is fast enough
        RECOGNITION_INTERVAL = 10

        print(f"📹 Video: {video_duration_sec:.1f}s | Processing at {self.processing_fps}fps")
        print(f"👥 Registered students loaded: {len(self.identifier.known_students)}")

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                if frame_idx % frame_skip != 0:
                    continue

                h, w = frame.shape[:2]
                timestamp_sec = frame_idx / video_fps

                # Run face recognition every RECOGNITION_INTERVAL frames
                run_recognition = (processed_count % RECOGNITION_INTERVAL == 0)

                detections = self._process_frame(
                    frame, processed_count, timestamp_sec,
                    w, h, run_recognition
                )

                tracker.update(
                    frame_no=processed_count,
                    timestamp_sec=timestamp_sec,
                    detections=detections,
                    frame_score_threshold=self.frame_score_threshold,
                )

                processed_count += 1

                # Report progress
                progress = int((frame_idx / total_video_frames) * 100)
                if progress != last_progress and progress % 5 == 0:
                    last_progress = progress
                    students_found = len([t for t in tracker.tracks.values() if t.total_frames >= 5])
                    if on_progress:
                        on_progress(progress, students_found)

        finally:
            cap.release()
            self.face_mesh.close()

        students = tracker.get_results(self.engagement_threshold)

        print(f"✅ Done: {len(students)} students, {processed_count} frames")

        return {
            'students':               students,
            'video_duration_sec':     round(video_duration_sec, 2),
            'total_frames_processed': processed_count,
            'processing_fps':         self.processing_fps,
        }

    def _process_frame(self, frame, frame_no, timestamp_sec, w, h, run_recognition):
        """Process one frame — detect faces, score signals, identify students."""

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results   = self.face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            return []

        detections = []

        for face_landmarks in results.multi_face_landmarks:
            try:
                # ── Bounding box ───────────────────────────
                x_coords = [lm.x for lm in face_landmarks.landmark]
                y_coords = [lm.y for lm in face_landmarks.landmark]
                bbox = (
                    max(0.0, min(x_coords) - 0.02),
                    max(0.0, min(y_coords) - 0.02),
                    min(1.0, max(x_coords) + 0.02),
                    min(1.0, max(y_coords) + 0.02),
                )

                # ── Face visibility score ──────────────────
                face_area         = (max(x_coords) - min(x_coords)) * (max(y_coords) - min(y_coords))
                face_visible_score = min(1.0, max(0.0, face_area / 0.04))

                # ── 5 engagement signals ───────────────────
                signals = {
                    'gaze':         calculate_gaze_score(face_landmarks, w, h),
                    'head_pose':    calculate_head_pose_score(face_landmarks, w, h),
                    'eye_open':     calculate_eye_open_score(face_landmarks, w, h),
                    'face_visible': face_visible_score,
                    'body_orient':  calculate_body_orientation(face_landmarks, w, h),
                }

                frame_score = calculate_frame_score(signals)

                # ── Face recognition (every N frames) ─────
                identity = None
                if run_recognition:
                    identity = self.identifier.identify_from_frame(frame, bbox, w, h)

                detections.append((bbox, signals, frame_score, identity))

            except Exception:
                continue

        return detections
