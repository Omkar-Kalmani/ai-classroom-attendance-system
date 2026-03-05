import numpy as np
from typing import List, Optional, Tuple
import cv2
import os

# ─────────────────────────────────────────────────────────────
#  Face Identifier — Using DeepFace
#
#  Why DeepFace instead of face_recognition?
#    - No CMake or dlib compilation needed
#    - pip install deepface — works on Windows instantly
#    - Uses deep learning models (more accurate)
#    - Supports multiple backends: VGG-Face, ArcFace, Facenet
#
#  How it works:
#    1. Student photo uploaded → DeepFace generates embedding
#       (512-number vector representing the face)
#    2. Video frame face detected → generate embedding
#    3. Compare embeddings → cosine distance
#    4. Distance < threshold → match found → student identified
# ─────────────────────────────────────────────────────────────

# Use ArcFace model — best accuracy for classroom scenarios
# Other options: "VGG-Face", "Facenet", "Facenet512", "OpenFace"
MODEL_NAME = "ArcFace"

# Distance threshold for face matching
# Lower = stricter (fewer false positives)
# Higher = looser (fewer false negatives)
DISTANCE_THRESHOLD = 0.68

# Lazy import — only load DeepFace when actually needed
# This prevents slow startup if DeepFace isn't used
_deepface = None

def _get_deepface():
    global _deepface
    if _deepface is None:
        from deepface import DeepFace
        _deepface = DeepFace
    return _deepface


def generate_face_encoding(photo_path: str) -> Optional[List[float]]:
    """
    Generate face embedding from a student photo using DeepFace.
    Called once when a student is registered.

    Args:
        photo_path: absolute path to student photo (JPG/PNG)

    Returns:
        List of floats (face embedding vector) or None if no face found
    """
    try:
        DeepFace = _get_deepface()

        # Generate embedding
        result = DeepFace.represent(
            img_path=photo_path,
            model_name=MODEL_NAME,
            enforce_detection=True,   # Raise error if no face found
            detector_backend="opencv",
        )

        if result and len(result) > 0:
            embedding = result[0]["embedding"]
            print(f"✅ Face encoding generated — {len(embedding)} dimensions")
            return embedding

        return None

    except Exception as e:
        print(f"❌ Face encoding failed: {e}")
        return None


class FaceIdentifier:
    """
    Identifies faces in video frames against registered student database.
    Uses DeepFace with ArcFace model for high accuracy.
    """

    def __init__(self):
        self.known_embeddings: List[np.ndarray] = []
        self.known_students:   List[dict]        = []
        self.loaded = False

    def load_students(self, students: List[dict]):
        """
        Load registered students into memory before video processing.

        Args:
            students: list of dicts — each must have:
                      _id, name, prn, faceEncoding (list of floats)
        """
        self.known_embeddings = []
        self.known_students   = []

        for student in students:
            encoding = student.get('faceEncoding')
            if encoding and len(encoding) > 0:
                self.known_embeddings.append(np.array(encoding, dtype=np.float64))
                self.known_students.append({
                    '_id':       str(student.get('_id', '')),
                    'name':      student.get('name', 'Unknown'),
                    'prn':       student.get('prn', ''),
                    'className': student.get('className', ''),
                })

        self.loaded = True
        print(f"👥 Loaded {len(self.known_students)} registered students")

    def identify_from_frame(
        self,
        frame: np.ndarray,
        bbox: Tuple[float, float, float, float],
        image_width: int,
        image_height: int,
    ) -> dict:
        """
        Identify a student from a face bounding box in a video frame.

        Args:
            frame: full BGR video frame
            bbox:  normalized (x1, y1, x2, y2) from MediaPipe
            image_width, image_height: frame dimensions

        Returns:
            {
                'identified': True/False,
                'studentId':  MongoDB _id or None,
                'name':       "Rahul Sharma" or "Unknown",
                'prn':        "2021CS001" or None,
                'confidence': 0.0 - 1.0
            }
        """
        if not self.loaded or not self.known_embeddings:
            return self._unknown()

        try:
            # ── Crop face from frame ───────────────────────
            top    = int(bbox[1] * image_height)
            left   = int(bbox[0] * image_width)
            bottom = int(bbox[3] * image_height)
            right  = int(bbox[2] * image_width)

            # Add padding
            pad    = 15
            top    = max(0,            top    - pad)
            left   = max(0,            left   - pad)
            bottom = min(image_height, bottom + pad)
            right  = min(image_width,  right  + pad)

            face_crop = frame[top:bottom, left:right]

            if face_crop.size == 0:
                return self._unknown()

            # ── Generate embedding for this face ───────────
            DeepFace = _get_deepface()

            result = DeepFace.represent(
                img_path=face_crop,
                model_name=MODEL_NAME,
                enforce_detection=False,  # Don't raise error — face already detected by MediaPipe
                detector_backend="skip",  # Skip detection — we already have the crop
            )

            if not result:
                return self._unknown()

            face_embedding = np.array(result[0]["embedding"], dtype=np.float64)

            # ── Compare against all known students ─────────
            best_idx      = -1
            best_distance = float('inf')

            for idx, known_embedding in enumerate(self.known_embeddings):
                # Cosine distance
                distance = self._cosine_distance(face_embedding, known_embedding)
                if distance < best_distance:
                    best_distance = distance
                    best_idx      = idx

            # ── Check if match is close enough ─────────────
            if best_idx >= 0 and best_distance <= DISTANCE_THRESHOLD:
                student    = self.known_students[best_idx]
                confidence = round(1.0 - (best_distance / DISTANCE_THRESHOLD), 3)
                return {
                    'identified': True,
                    'studentId':  student['_id'],
                    'name':       student['name'],
                    'prn':        student['prn'],
                    'className':  student['className'],
                    'confidence': max(0.0, confidence),
                }

            return self._unknown()

        except Exception as e:
            # Silent fail — don't crash video processing
            return self._unknown()

    def _cosine_distance(self, a: np.ndarray, b: np.ndarray) -> float:
        """
        Calculate cosine distance between two embedding vectors.
        0.0 = identical faces
        1.0 = completely different faces
        """
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 1.0

        cosine_similarity = np.dot(a, b) / (norm_a * norm_b)
        return 1.0 - cosine_similarity

    def _unknown(self) -> dict:
        return {
            'identified': False,
            'studentId':  None,
            'name':       'Unknown',
            'prn':        None,
            'className':  None,
            'confidence': 0.0,
        }
