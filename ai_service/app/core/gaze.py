import numpy as np


# ─────────────────────────────────────────────────────────────
#  Gaze Analyzer
#  Estimates where a student is looking using iris landmarks.
#
#  MediaPipe Face Mesh provides iris landmarks (indices 468-477)
#  which tell us the center of each iris.
#
#  We compare the iris position within the eye socket to
#  determine if the student is looking forward (at the board)
#  or looking away (down at phone, sideways, etc.)
# ─────────────────────────────────────────────────────────────

# Iris landmark indices (MediaPipe)
LEFT_IRIS_CENTER  = 468
RIGHT_IRIS_CENTER = 473

# Eye corner landmarks
LEFT_EYE_LEFT_CORNER  = 263
LEFT_EYE_RIGHT_CORNER = 362
RIGHT_EYE_LEFT_CORNER = 133
RIGHT_EYE_RIGHT_CORNER = 33

# Upper/lower eye landmarks for vertical gaze
LEFT_EYE_TOP    = 386
LEFT_EYE_BOTTOM = 374
RIGHT_EYE_TOP   = 159
RIGHT_EYE_BOTTOM = 145

# Gaze offset threshold — beyond this = looking away
HORIZONTAL_THRESHOLD = 0.25   # normalized units
VERTICAL_THRESHOLD   = 0.25


def _get_gaze_ratio(iris_x, iris_y, left_corner, right_corner, top, bottom):
    """
    Calculate normalized iris position within the eye socket.
    Returns (horizontal_ratio, vertical_ratio) where:
        0.5, 0.5 = looking straight forward
        0.0, x   = looking far left
        1.0, x   = looking far right
        x, 0.0   = looking up
        x, 1.0   = looking down
    """
    eye_width  = abs(right_corner[0] - left_corner[0])
    eye_height = abs(bottom[1] - top[1])

    if eye_width < 1e-6 or eye_height < 1e-6:
        return 0.5, 0.5

    h_ratio = (iris_x - left_corner[0]) / eye_width
    v_ratio = (iris_y - top[1]) / eye_height

    return h_ratio, v_ratio


def calculate_gaze_score(face_landmarks, image_width, image_height):
    """
    Calculate gaze score from 0.0 to 1.0.

    Score interpretation:
        1.0  — looking straight at the camera/board
        0.5  — slightly off-center gaze
        0.0  — looking away (down, sideways)

    This is the highest-weighted signal (35%) because
    where you look is the strongest indicator of attention.
    """
    try:
        lm = face_landmarks.landmark

        def pt(idx):
            return np.array([lm[idx].x * image_width, lm[idx].y * image_height])

        # ── Left Eye Gaze ──────────────────────────────────────
        left_iris = pt(LEFT_IRIS_CENTER)
        left_h, left_v = _get_gaze_ratio(
            left_iris[0], left_iris[1],
            pt(LEFT_EYE_LEFT_CORNER), pt(LEFT_EYE_RIGHT_CORNER),
            pt(LEFT_EYE_TOP), pt(LEFT_EYE_BOTTOM)
        )

        # ── Right Eye Gaze ─────────────────────────────────────
        right_iris = pt(RIGHT_IRIS_CENTER)
        right_h, right_v = _get_gaze_ratio(
            right_iris[0], right_iris[1],
            pt(RIGHT_EYE_LEFT_CORNER), pt(RIGHT_EYE_RIGHT_CORNER),
            pt(RIGHT_EYE_TOP), pt(RIGHT_EYE_BOTTOM)
        )

        # Average both eyes
        avg_h = (left_h + right_h) / 2
        avg_v = (left_v + right_v) / 2

        # ── Score Calculation ──────────────────────────────────
        # How far from center (0.5) is the gaze?
        h_deviation = abs(avg_h - 0.5)
        v_deviation = abs(avg_v - 0.5)

        # Convert deviation to score
        # 0.0 deviation = score 1.0 (looking straight)
        # 0.25+ deviation = score 0.0 (looking away)
        h_score = max(0.0, 1.0 - (h_deviation / HORIZONTAL_THRESHOLD))
        v_score = max(0.0, 1.0 - (v_deviation / VERTICAL_THRESHOLD))

        # Horizontal gaze matters more than vertical
        gaze_score = 0.6 * h_score + 0.4 * v_score

        return float(np.clip(gaze_score, 0.0, 1.0))

    except Exception:
        # If iris landmarks not available (older MediaPipe),
        # fall back to head pose as proxy for gaze
        return 0.5
