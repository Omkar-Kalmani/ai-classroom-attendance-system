import numpy as np
from typing import Dict, List, Tuple, Optional


# ─────────────────────────────────────────────────────────────
#  Student Tracker
#  Assigns persistent IDs to detected faces across video frames.
#
#  Problem: MediaPipe detects faces per frame independently.
#  Without tracking, a student detected in frame 1 and frame 2
#  might get different IDs — we can't track their engagement.
#
#  Solution: IoU (Intersection over Union) matching.
#  If a face bounding box in frame N overlaps significantly
#  with a tracked face from frame N-1, they're the same person.
#
#  IoU = overlap area / union area
#  IoU > 0.3 = same person (most likely)
#  IoU < 0.3 = new person or person moved too much
# ─────────────────────────────────────────────────────────────

IOU_THRESHOLD     = 0.3     # Min overlap to consider same person
MAX_MISSING_FRAMES = 30     # Remove track after missing this many frames


class Track:
    """
    Represents one tracked student across frames.
    """
    def __init__(self, track_id: int, bbox: Tuple[float, float, float, float]):
        self.track_id = track_id
        self.bbox = bbox                # (x1, y1, x2, y2) normalized
        self.missing_frames = 0         # How many frames we haven't seen this student
        self.total_frames = 0           # Total frames this student appeared
        self.attentive_frames = 0       # Frames where engagement was high
        self.signal_scores = {          # Running totals for averaging
            'gaze': 0.0,
            'head_pose': 0.0,
            'eye_open': 0.0,
            'face_visible': 0.0,
            'body_orient': 0.0,
        }
        self.frame_timeline = []        # Sampled frame data for charts


def _calculate_iou(box1: Tuple, box2: Tuple) -> float:
    """
    Calculate Intersection over Union between two bounding boxes.

    Args:
        box1, box2: (x1, y1, x2, y2) normalized coordinates

    Returns:
        IoU score from 0.0 (no overlap) to 1.0 (perfect overlap)
    """
    # Find intersection rectangle
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    # No intersection
    if x2 <= x1 or y2 <= y1:
        return 0.0

    intersection = (x2 - x1) * (y2 - y1)

    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    if union < 1e-6:
        return 0.0

    return intersection / union


class StudentTracker:
    """
    Tracks students across video frames using IoU matching.

    Usage:
        tracker = StudentTracker()

        for each frame:
            detections = [(bbox, signals), ...]
            tracker.update(frame_no, timestamp, detections, threshold)

        results = tracker.get_results(engagement_threshold)
    """

    def __init__(self):
        self.tracks: Dict[int, Track] = {}      # track_id → Track
        self.next_id = 1                         # Auto-incrementing ID counter
        self.frame_sample_rate = 10              # Store every 10th frame for timeline

    def update(
        self,
        frame_no: int,
        timestamp_sec: float,
        detections: List[Tuple],                 # [(bbox, signals, face_score), ...]
        frame_score_threshold: float = 0.6
    ):
        """
        Match current frame's detections to existing tracks.
        Update scores for matched tracks.
        Create new tracks for unmatched detections.

        Args:
            frame_no: current frame number
            timestamp_sec: timestamp in seconds
            detections: list of (bbox, signal_scores, frame_score) tuples
            frame_score_threshold: score >= this = attentive frame
        """
        if not detections:
            # No faces detected — increment missing counter for all tracks
            for track in self.tracks.values():
                track.missing_frames += 1
            self._remove_lost_tracks()
            return

        active_track_ids = list(self.tracks.keys())
        matched_track_ids = set()
        matched_detection_indices = set()

        # ── Match detections to existing tracks ───────────────
        if active_track_ids:
            # Build IoU matrix: tracks × detections
            iou_matrix = np.zeros((len(active_track_ids), len(detections)))

            for t_idx, track_id in enumerate(active_track_ids):
                for d_idx, (bbox, _, _) in enumerate(detections):
                    iou_matrix[t_idx][d_idx] = _calculate_iou(
                        self.tracks[track_id].bbox, bbox
                    )

            # Greedy matching — match highest IoU pairs first
            while True:
                if iou_matrix.max() < IOU_THRESHOLD:
                    break

                t_idx, d_idx = np.unravel_index(iou_matrix.argmax(), iou_matrix.shape)
                track_id = active_track_ids[t_idx]

                # Update matched track
                bbox, signals, frame_score = detections[d_idx]
                self._update_track(
                    track_id, bbox, signals, frame_score,
                    frame_no, timestamp_sec, frame_score_threshold
                )

                matched_track_ids.add(track_id)
                matched_detection_indices.add(d_idx)

                # Prevent re-matching
                iou_matrix[t_idx, :] = 0
                iou_matrix[:, d_idx] = 0

        # ── Increment missing counter for unmatched tracks ─────
        for track_id in active_track_ids:
            if track_id not in matched_track_ids:
                self.tracks[track_id].missing_frames += 1

        # ── Create new tracks for unmatched detections ─────────
        for d_idx, (bbox, signals, frame_score) in enumerate(detections):
            if d_idx not in matched_detection_indices:
                new_track = Track(self.next_id, bbox)
                self._update_track(
                    self.next_id, bbox, signals, frame_score,
                    frame_no, timestamp_sec, frame_score_threshold
                )
                self.tracks[self.next_id] = new_track
                self.next_id += 1

        self._remove_lost_tracks()

    def _update_track(self, track_id, bbox, signals, frame_score,
                      frame_no, timestamp_sec, frame_score_threshold):
        """Update a track with new frame data."""
        if track_id not in self.tracks:
            self.tracks[track_id] = Track(track_id, bbox)

        track = self.tracks[track_id]
        track.bbox = bbox
        track.missing_frames = 0
        track.total_frames += 1

        is_attentive = frame_score >= frame_score_threshold
        if is_attentive:
            track.attentive_frames += 1

        # Accumulate signal scores for averaging later
        for key in track.signal_scores:
            track.signal_scores[key] += signals.get(key, 0.0)

        # Sample frame timeline (every Nth frame to limit data size)
        if frame_no % self.frame_sample_rate == 0:
            track.frame_timeline.append({
                'frameNo': frame_no,
                'timestampSec': round(timestamp_sec, 2),
                'frameScore': round(frame_score, 3),
                'isAttentive': is_attentive,
            })

    def _remove_lost_tracks(self):
        """Remove tracks that haven't been seen for too long."""
        lost = [
            tid for tid, track in self.tracks.items()
            if track.missing_frames > MAX_MISSING_FRAMES
        ]
        for tid in lost:
            del self.tracks[tid]

    def get_results(self, engagement_threshold: float = 70.0) -> List[dict]:
        """
        Convert all tracks to final student result dictionaries.
        Only include tracks that appeared in at least 10 frames
        (filters out brief false detections).
        """
        results = []

        for track_id, track in self.tracks.items():
            # Filter out very brief detections
            if track.total_frames < 10:
                continue

            # Calculate engagement score
            engagement_score = (
                track.attentive_frames / track.total_frames * 100
                if track.total_frames > 0 else 0.0
            )

            # Calculate average signal scores
            signal_breakdown = {
                key: round(val / track.total_frames, 3)
                for key, val in track.signal_scores.items()
            }

            results.append({
                'trackId': track_id,
                'label': f'Student #{track_id}',
                'totalFrames': track.total_frames,
                'attentiveFrames': track.attentive_frames,
                'engagementScore': round(engagement_score, 2),
                'attendanceStatus': 'present' if engagement_score >= engagement_threshold else 'absent',
                'signalBreakdown': {
                    'gazeAvg':        signal_breakdown.get('gaze', 0),
                    'headPoseAvg':    signal_breakdown.get('head_pose', 0),
                    'eyeOpenAvg':     signal_breakdown.get('eye_open', 0),
                    'faceVisibleAvg': signal_breakdown.get('face_visible', 0),
                    'bodyOrientAvg':  signal_breakdown.get('body_orient', 0),
                },
                'frameTimeline': track.frame_timeline,
            })

        return results
