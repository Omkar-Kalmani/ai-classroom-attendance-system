import numpy as np


# ─────────────────────────────────────────────────────────────
#  Eye State Analyzer
#  Uses Eye Aspect Ratio (EAR) to determine if eyes are open.
#
#  EAR = (vertical distances) / (horizontal distance)
#  When eye is open:  EAR ≈ 0.25 - 0.35
#  When eye is closed: EAR ≈ 0.0 - 0.10
#
#  MediaPipe face mesh gives us 478 landmarks.
#  We use specific landmark indices for each eye.
# ─────────────────────────────────────────────────────────────

# MediaPipe face mesh landmark indices for eyes
# Left eye landmarks (from MediaPipe documentation)
LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
# Right eye landmarks
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

# EAR threshold — below this = eye is closed
EAR_THRESHOLD = 0.15


def _calculate_ear(landmarks, eye_indices, image_width, image_height):
    """
    Calculate Eye Aspect Ratio for one eye.

    EAR formula:
        EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)

    Where p1-p6 are the 6 eye landmark points:
        p1 = left corner
        p2, p3 = upper lid points
        p4 = right corner
        p5, p6 = lower lid points
    """
    # Extract the 6 landmark coordinates
    points = []
    for idx in eye_indices:
        lm = landmarks[idx]
        x = lm.x * image_width
        y = lm.y * image_height
        points.append(np.array([x, y]))

    # Vertical distances (p2-p6 and p3-p5)
    vertical_1 = np.linalg.norm(points[1] - points[5])
    vertical_2 = np.linalg.norm(points[2] - points[4])

    # Horizontal distance (p1-p4)
    horizontal = np.linalg.norm(points[0] - points[3])

    if horizontal < 1e-6:
        return 0.0

    ear = (vertical_1 + vertical_2) / (2.0 * horizontal)
    return ear


def calculate_eye_open_score(face_landmarks, image_width, image_height):
    """
    Calculate eye openness score from 0.0 to 1.0.

    Returns:
        1.0  — both eyes clearly open
        0.5  — one eye open
        0.0  — both eyes closed or not detected

    This score becomes the eye_open signal in engagement scoring.
    """
    try:
        landmarks = face_landmarks.landmark

        left_ear  = _calculate_ear(landmarks, LEFT_EYE_INDICES,  image_width, image_height)
        right_ear = _calculate_ear(landmarks, RIGHT_EYE_INDICES, image_width, image_height)

        left_open  = left_ear  > EAR_THRESHOLD
        right_open = right_ear > EAR_THRESHOLD

        if left_open and right_open:
            # Both open — normalize EAR to 0.0-1.0 score
            avg_ear = (left_ear + right_ear) / 2.0
            # Clamp and normalize: EAR of 0.15 = score 0.0, EAR of 0.35 = score 1.0
            score = min(1.0, max(0.0, (avg_ear - EAR_THRESHOLD) / (0.35 - EAR_THRESHOLD)))
            return score
        elif left_open or right_open:
            return 0.5
        else:
            return 0.0

    except Exception:
        return 0.0
