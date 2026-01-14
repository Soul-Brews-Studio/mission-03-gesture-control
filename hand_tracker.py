#!/usr/bin/env python3
"""
MediaPipe Hand Tracker -> MQTT (Tasks API for v0.10+)
"""

import cv2
import json
import time
import paho.mqtt.client as mqtt
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import urllib.request
import os

# MQTT Setup
BROKER = "localhost"
PORT = 1883
TOPIC = "hand/landmarks"

# Model path
MODEL_PATH = "hand_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

def download_model():
    if not os.path.exists(MODEL_PATH):
        print(f"📥 Downloading model...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"✅ Model downloaded: {MODEL_PATH}")

def main():
    download_model()

    # Connect to MQTT
    client = mqtt.Client()
    try:
        client.connect(BROKER, PORT, 60)
        client.loop_start()
        print(f"✅ MQTT connected to {BROKER}:{PORT}")
    except Exception as e:
        print(f"❌ MQTT connection failed: {e}")
        return

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
        print("❌ Cannot open camera")
        return

    print("📷 Camera opened")
    print("🖐️ Starting hand tracking... Press 'q' to quit")

    frame_count = 0
    start_time = time.time()

    # Hand connections for drawing
    CONNECTIONS = [
        (0,1),(1,2),(2,3),(3,4),  # Thumb
        (0,5),(5,6),(6,7),(7,8),  # Index
        (0,9),(9,10),(10,11),(11,12),  # Middle
        (0,13),(13,14),(14,15),(15,16),  # Ring
        (0,17),(17,18),(18,19),(19,20),  # Pinky
        (5,9),(9,13),(13,17)  # Palm
    ]

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Flip for selfie view
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # Convert to MediaPipe Image
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # Detect
        result = detector.detect(mp_image)

        # Prepare MQTT message
        message = {
            "timestamp": int(time.time() * 1000),
            "hands": []
        }

        if result.hand_landmarks:
            for hand_idx, hand_landmarks in enumerate(result.hand_landmarks):
                # Get handedness
                handedness = "Unknown"
                if result.handedness and hand_idx < len(result.handedness):
                    handedness = result.handedness[hand_idx][0].category_name

                # Extract landmarks
                landmarks = []
                pts = []
                for lm in hand_landmarks:
                    landmarks.append({"x": lm.x, "y": lm.y, "z": lm.z})
                    pts.append((int(lm.x * w), int(lm.y * h)))

                message["hands"].append({
                    "handedness": handedness,
                    "landmarks": landmarks
                })

                # Draw skeleton
                color = (255, 255, 0) if handedness == "Left" else (255, 0, 255)
                for c1, c2 in CONNECTIONS:
                    cv2.line(frame, pts[c1], pts[c2], color, 2)

                # Draw points
                for i, pt in enumerate(pts):
                    cv2.circle(frame, pt, 5, (0, 255, 0), -1)

        # Publish to MQTT
        client.publish(TOPIC, json.dumps(message))

        # FPS
        frame_count += 1
        elapsed = time.time() - start_time
        if elapsed >= 1.0:
            fps = frame_count / elapsed
            print(f"📊 FPS: {fps:.1f} | Hands: {len(message['hands'])}")
            frame_count = 0
            start_time = time.time()

        # Show
        cv2.imshow("MediaPipe Hand Tracker", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    client.loop_stop()
    client.disconnect()
    print("👋 Goodbye!")

if __name__ == "__main__":
    main()
