import numpy as np


# ─────────────────────────────────────────────────────────────
#  Head Pose Estimator
#  Uses facial landmark geometry to estimate head orientation.
#
#  We calculate 3 angles:
#    Yaw   — left/right rotation (looking sideways)
#    Pitch — up/down rotation (looking up/down)
#    Roll  — tilting head left/right
#
#  A student looking straight at the board has:
#    yaw ≈ 0°, pitch ≈ 0°, roll ≈ 0°
# ─────────────────────────────────────────────────────────────

# Key landmark indices for head pose estimation
# These are stable points that don't move much with expressions
NOSE_TIP        = 1
CHIN            = 152
LEFT_EYE_LEFT   = 263
RIGHT_EYE_RIGHT = 33
LEFT_MOUTH      = 287
RIGHT_MOUTH     = 57

# Thresholds — beyond these angles, student is "not facing forward"
YAW_THRESHOLD   = 30    # degrees — looking left/right
PITCH_THRESHOLD = 20    # degrees — looking up/down
ROLL_THRESHOLD  = 25    # degrees — head tilt


def calculate_head_pose_score(face_landmarks, image_width, image_height):
    """
    Calculate head pose score from 0.0 to 1.0.

    Score interpretation:
        1.0  — facing straight forward (fully attentive)
        0.5  — slightly turned
        0.0  — facing away from camera

    Uses the geometric relationship between key facial landmarks
    to estimate yaw, pitch, and roll without needing a 3D model.
    """
    try:
        lm = face_landmarks.landmark

        def get_point(idx):
            return np.array([
                lm[idx].x * image_width,
                lm[idx].y * image_height
            ])

        nose      = get_point(NOSE_TIP)
        chin      = get_point(CHIN)
        left_eye  = get_point(LEFT_EYE_LEFT)
        right_eye = get_point(RIGHT_EYE_RIGHT)
        left_mouth  = get_point(LEFT_MOUTH)
        right_mouth = get_point(RIGHT_MOUTH)

        # ── Estimate YAW (left/right rotation) ────────────────
        # Compare horizontal position of nose relative to eye midpoint
        eye_center_x = (left_eye[0] + right_eye[0]) / 2
        eye_width = abs(left_eye[0] - right_eye[0])

        if eye_width < 1e-6:
            return 0.0

        # Normalized offset of nose from eye center
        nose_offset = (nose[0] - eye_center_x) / eye_width
        # Convert to approximate degrees
        yaw_deg = nose_offset * 90

        # ── Estimate PITCH (up/down rotation) ─────────────────
        # Compare vertical ratio of nose to face height
        face_height = abs(chin[1] - ((left_eye[1] + right_eye[1]) / 2))

        if face_height < 1e-6:
            return 0.0

        nose_vertical = nose[1] - ((left_eye[1] + right_eye[1]) / 2)
        pitch_ratio = nose_vertical / face_height
        # Typical ratio when facing forward: ~0.45
        pitch_deg = (pitch_ratio - 0.45) * 100

        # ── Estimate ROLL (head tilt) ──────────────────────────
        eye_dy = right_eye[1] - left_eye[1]
        eye_dx = right_eye[0] - left_eye[0]
        roll_deg = np.degrees(np.arctan2(eye_dy, eye_dx))

        # ── Calculate Score ────────────────────────────────────
        yaw_score   = max(0.0, 1.0 - abs(yaw_deg)   / YAW_THRESHOLD)
        pitch_score = max(0.0, 1.0 - abs(pitch_deg) / PITCH_THRESHOLD)
        roll_score  = max(0.0, 1.0 - abs(roll_deg)  / ROLL_THRESHOLD)

        # Weighted combination: yaw matters most
        head_pose_score = (
            0.50 * yaw_score   +
            0.35 * pitch_score +
            0.15 * roll_score
        )

        return float(np.clip(head_pose_score, 0.0, 1.0))

    except Exception:
        return 0.0
