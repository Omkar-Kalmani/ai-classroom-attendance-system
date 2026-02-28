# ─────────────────────────────────────────────────────────────
#  Engagement Scorer
#  Combines 5 signals into one weighted engagement score per frame.
#
#  Formula:
#    frame_score = (0.35 × gaze) + (0.30 × head_pose) +
#                  (0.20 × eye_open) + (0.10 × face_visible) +
#                  (0.05 × body_orient)
#
#  A frame is "attentive" if frame_score >= FRAME_SCORE_THRESHOLD (0.6)
#  Final engagement = (attentive_frames / total_frames) × 100
#  Student is PRESENT if engagement >= ENGAGEMENT_THRESHOLD (70%)
# ─────────────────────────────────────────────────────────────

# Signal weights — must sum to 1.0
WEIGHTS = {
    'gaze':         0.35,   # Highest weight — eye direction = attention
    'head_pose':    0.30,   # Head facing forward = engaged
    'eye_open':     0.20,   # Eyes open = awake and watching
    'face_visible': 0.10,   # Face clearly visible = present
    'body_orient':  0.05,   # Body facing forward = engaged
}


def calculate_frame_score(signals: dict) -> float:
    """
    Calculate weighted engagement score for one frame.

    Args:
        signals: dict with keys matching WEIGHTS
                 Each value is 0.0 to 1.0

    Returns:
        Weighted score from 0.0 to 1.0
        >= 0.6 = student is attentive in this frame

    Example:
        signals = {
            'gaze': 0.9,          # Looking forward
            'head_pose': 0.8,     # Head facing camera
            'eye_open': 1.0,      # Eyes wide open
            'face_visible': 1.0,  # Face clearly detected
            'body_orient': 0.7,   # Mostly facing forward
        }
        score = 0.35*0.9 + 0.30*0.8 + 0.20*1.0 + 0.10*1.0 + 0.05*0.7
              = 0.315 + 0.240 + 0.200 + 0.100 + 0.035
              = 0.890  → attentive ✅
    """
    score = sum(
        WEIGHTS[signal] * value
        for signal, value in signals.items()
        if signal in WEIGHTS
    )
    return round(min(1.0, max(0.0, score)), 4)


def calculate_body_orientation(face_landmarks, image_width, image_height):
    """
    Estimate body/shoulder orientation from face position and size.

    Since we only have face landmarks (no pose landmarks),
    we use face width as a proxy for body orientation:
    - Wide face = facing camera = body facing forward
    - Narrow face = profile view = body turned away

    This is the lowest-weighted signal (5%) because it's
    the least accurate estimation.

    Returns: 0.0 to 1.0
    """
    try:
        lm = face_landmarks.landmark

        # Get face bounding box width
        x_coords = [lm[i].x for i in range(len(lm))]
        face_width = max(x_coords) - min(x_coords)

        # Normalize: typical frontal face width ≈ 0.15-0.25 of image width
        # Profile face width ≈ 0.05-0.10 of image width
        score = min(1.0, max(0.0, (face_width - 0.05) / (0.20 - 0.05)))
        return float(score)

    except Exception:
        return 0.5
