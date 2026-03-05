import numpy as np
from typing import Dict, List, Tuple, Optional

IOU_THRESHOLD      = 0.3
MAX_MISSING_FRAMES = 30


class Track:
    def __init__(self, track_id: int, bbox: Tuple):
        self.track_id       = track_id
        self.bbox           = bbox
        self.missing_frames = 0
        self.total_frames   = 0
        self.attentive_frames = 0
        self.signal_scores  = {
            'gaze': 0.0, 'head_pose': 0.0,
            'eye_open': 0.0, 'face_visible': 0.0, 'body_orient': 0.0,
        }
        self.frame_timeline = []

        # ── Identity fields (NEW) ──────────────────────────
        self.student_id   = None    # MongoDB _id of matched student
        self.name         = None    # "Rahul Sharma"
        self.prn          = None    # "2021CS001"
        self.class_name   = None    # "CS-A"
        self.identified   = False   # True once matched to a registered student
        self.id_votes     = {}      # studentId → vote count (for majority voting)


def _calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    if x2 <= x1 or y2 <= y1:
        return 0.0

    intersection = (x2 - x1) * (y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    return 0.0 if union < 1e-6 else intersection / union


class StudentTracker:
    def __init__(self):
        self.tracks: Dict[int, Track] = {}
        self.next_id = 1
        self.frame_sample_rate = 10

    def update(self, frame_no, timestamp_sec, detections, frame_score_threshold=0.6):
        """
        detections: list of (bbox, signals, frame_score, identity)
        identity: dict from FaceIdentifier or None
        """
        if not detections:
            for track in self.tracks.values():
                track.missing_frames += 1
            self._remove_lost_tracks()
            return

        active_track_ids = list(self.tracks.keys())
        matched_track_ids = set()
        matched_detection_indices = set()

        if active_track_ids:
            iou_matrix = np.zeros((len(active_track_ids), len(detections)))
            for t_idx, track_id in enumerate(active_track_ids):
                for d_idx, (bbox, _, _, _) in enumerate(detections):
                    iou_matrix[t_idx][d_idx] = _calculate_iou(self.tracks[track_id].bbox, bbox)

            while iou_matrix.max() >= IOU_THRESHOLD:
                t_idx, d_idx = np.unravel_index(iou_matrix.argmax(), iou_matrix.shape)
                track_id = active_track_ids[t_idx]
                bbox, signals, frame_score, identity = detections[d_idx]
                self._update_track(track_id, bbox, signals, frame_score, identity,
                                   frame_no, timestamp_sec, frame_score_threshold)
                matched_track_ids.add(track_id)
                matched_detection_indices.add(d_idx)
                iou_matrix[t_idx, :] = 0
                iou_matrix[:, d_idx] = 0

        for track_id in active_track_ids:
            if track_id not in matched_track_ids:
                self.tracks[track_id].missing_frames += 1

        for d_idx, (bbox, signals, frame_score, identity) in enumerate(detections):
            if d_idx not in matched_detection_indices:
                new_id = self.next_id
                self.tracks[new_id] = Track(new_id, bbox)
                self._update_track(new_id, bbox, signals, frame_score, identity,
                                   frame_no, timestamp_sec, frame_score_threshold)
                self.next_id += 1

        self._remove_lost_tracks()

    def _update_track(self, track_id, bbox, signals, frame_score, identity,
                      frame_no, timestamp_sec, frame_score_threshold):
        track = self.tracks[track_id]
        track.bbox = bbox
        track.missing_frames = 0
        track.total_frames += 1

        if frame_score >= frame_score_threshold:
            track.attentive_frames += 1

        for key in track.signal_scores:
            track.signal_scores[key] += signals.get(key, 0.0)

        # ── Update identity via majority voting ────────────
        # We vote across multiple frames to get stable identification
        if identity and identity.get('identified'):
            sid = identity['studentId']
            track.id_votes[sid] = track.id_votes.get(sid, 0) + 1

            # After 3 votes for same student → lock identity
            if track.id_votes[sid] >= 3 and not track.identified:
                track.identified  = True
                track.student_id  = sid
                track.name        = identity['name']
                track.prn         = identity['prn']
                track.class_name  = identity.get('className', '')

        # Sample frame timeline
        if frame_no % self.frame_sample_rate == 0:
            track.frame_timeline.append({
                'frameNo':      frame_no,
                'timestampSec': round(timestamp_sec, 2),
                'frameScore':   round(frame_score, 3),
                'isAttentive':  frame_score >= frame_score_threshold,
            })

    def _remove_lost_tracks(self):
        lost = [tid for tid, t in self.tracks.items() if t.missing_frames > MAX_MISSING_FRAMES]
        for tid in lost:
            del self.tracks[tid]

    def get_results(self, engagement_threshold=70.0):
        results = []

        for track_id, track in self.tracks.items():
            if track.total_frames < 10:
                continue

            engagement_score = (track.attentive_frames / track.total_frames * 100
                                if track.total_frames > 0 else 0.0)

            signal_breakdown = {
                key: round(val / track.total_frames, 3)
                for key, val in track.signal_scores.items()
            }

            # Use identified name or fall back to anonymous label
            label = track.name if track.identified else f"Unknown #{track_id}"

            results.append({
                'trackId':         track_id,
                'label':           label,
                'name':            track.name,
                'prn':             track.prn,
                'className':       track.class_name,
                'studentDbId':     track.student_id,
                'identified':      track.identified,
                'totalFrames':     track.total_frames,
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
