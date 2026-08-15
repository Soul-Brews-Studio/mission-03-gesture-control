#!/usr/bin/env python3
"""
MediaPipe Hand Tracker - Standalone (No MQTT)
Combines hand tracking + gesture detection in one script.
"""

import cv2
import time
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import urllib.request
import os
from dataclasses import dataclass
from typing import Optional, List, Dict

# Model path
MODEL_PATH = "hand_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

@dataclass
class Gesture:
    name: str
    confidence: float

def download_model():
    if not os.path.exists(MODEL_PATH):
        print(f"Downloading model...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"Model downloaded: {MODEL_PATH}")

def distance(lm1: Dict, lm2: Dict) -> float:
    """Calculate 2D distance between two landmarks."""
    return ((lm1['x'] - lm2['x'])**2 + (lm1['y'] - lm2['y'])**2) ** 0.5

# ============================================================
# Gesture Detection Functions
# ============================================================

def detect_fist(landmarks: List[Dict]) -> Optional[Gesture]:
    """Detect closed fist - fingertips below base joints."""
    closed = 0
    # Check index, middle, ring, pinky
    pairs = [(8, 6), (12, 10), (16, 14), (20, 18)]
    for tip, base in pairs:
        if landmarks[tip]['y'] > landmarks[base]['y']:
            closed += 1

    if closed >= 4:
        return Gesture("fist", closed / 4.0)
    return None

def detect_open_palm(landmarks: List[Dict]) -> Optional[Gesture]:
    """Detect open palm - all fingertips extended from wrist."""
    extended = 0
    tips = [4, 8, 12, 16, 20]
    wrist = landmarks[0]

    for tip in tips:
        if distance(landmarks[tip], wrist) > 0.2:
            extended += 1

    if extended >= 4:
        return Gesture("open_palm", extended / 5.0)
    return None

def detect_pinch(landmarks: List[Dict]) -> Optional[Gesture]:
    """Detect pinch - thumb tip close to index tip."""
    d = distance(landmarks[4], landmarks[8])
    if d < 0.05:
        return Gesture("pinch", 1.0 - (d / 0.05))
    return None

def detect_point(landmarks: List[Dict]) -> Optional[Gesture]:
    """Detect pointing - only index extended."""
    # Index extended
    index_extended = distance(landmarks[8], landmarks[0]) > 0.2

    # Others closed
    others_closed = 0
    pairs = [(12, 10), (16, 14), (20, 18)]
    for tip, base in pairs:
        if landmarks[tip]['y'] > landmarks[base]['y']:
            others_closed += 1

    if index_extended and others_closed >= 2:
        return Gesture("point", 0.8)
    return None

def detect_peace(landmarks: List[Dict]) -> Optional[Gesture]:
    """Detect peace sign - index + middle extended."""
    wrist = landmarks[0]

    index_extended = distance(landmarks[8], wrist) > 0.2
    middle_extended = distance(landmarks[12], wrist) > 0.2

    ring_closed = landmarks[16]['y'] > landmarks[14]['y']
    pinky_closed = landmarks[20]['y'] > landmarks[18]['y']

    if index_extended and middle_extended and ring_closed and pinky_closed:
        return Gesture("peace", 0.9)
    return None

def detect_gestures(landmarks: List[Dict]) -> List[Gesture]:
    """Run all gesture detectors."""
    gestures = []

    detectors = [
        detect_fist,
        detect_open_palm,
        detect_pinch,
        detect_point,
        detect_peace,
    ]

    for detector in detectors:
        result = detector(landmarks)
        if result and result.confidence > 0.5:
            gestures.append(result)

    return gestures

def main():
    download_model()

    # MediaPipe Hand Landmarker
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    detector = vision.HandLandmarker.create_from_options(options)

    # Open camera
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    if not cap.isOpened():
        print("Cannot open camera")
        return

    print("Camera opened - No MQTT mode")
    print("Hand tracking + gesture detection")
    print("Press 'q' to quit")

    frame_count = 0
    start_time = time.time()
    last_gesture = ""

    # Hand connections for drawing
    CONNECTIONS = [
        (0,1),(1,2),(2,3),(3,4),
        (0,5),(5,6),(6,7),(7,8),
        (0,9),(9,10),(10,11),(11,12),
        (0,13),(13,14),(14,15),(15,16),
        (0,17),(17,18),(18,19),(19,20),
        (5,9),(9,13),(13,17)
    ]

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        result = detector.detect(mp_image)

        num_hands = 0
        all_gestures = []

        if result.hand_landmarks:
            num_hands = len(result.hand_landmarks)

            # Two hands detection
            if num_hands >= 2:
                all_gestures.append("two_hands")

            for hand_idx, hand_landmarks in enumerate(result.hand_landmarks):
                handedness = "Unknown"
                if result.handedness and hand_idx < len(result.handedness):
                    handedness = result.handedness[hand_idx][0].category_name

                # Convert to dict format for gesture detection
                landmarks = []
                pts = []
                for lm in hand_landmarks:
                    landmarks.append({"x": lm.x, "y": lm.y, "z": lm.z})
                    pts.append((int(lm.x * w), int(lm.y * h)))

                # Detect gestures
                gestures = detect_gestures(landmarks)
                for g in gestures:
                    all_gestures.append(f"{handedness}: {g.name}")

                # Draw skeleton
                color = (255, 255, 0) if handedness == "Left" else (255, 0, 255)
                for c1, c2 in CONNECTIONS:
                    cv2.line(frame, pts[c1], pts[c2], color, 2)

                for i, pt in enumerate(pts):
                    cv2.circle(frame, pt, 5, (0, 255, 0), -1)

        # Display gesture on frame
        gesture_text = ", ".join(all_gestures) if all_gestures else "No gesture"
        cv2.putText(frame, gesture_text, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        # Print when gesture changes
        if gesture_text != last_gesture:
            print(f"Gesture: {gesture_text}")
            last_gesture = gesture_text

        # FPS counter
        frame_count += 1
        elapsed = time.time() - start_time
        if elapsed >= 2.0:
            fps = frame_count / elapsed
            print(f"FPS: {fps:.1f} | Hands: {num_hands}")
            frame_count = 0
            start_time = time.time()

        cv2.imshow("Hand Tracker (Standalone)", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Goodbye!")

if __name__ == "__main__":
    main()
