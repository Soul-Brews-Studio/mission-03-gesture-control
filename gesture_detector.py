#!/usr/bin/env python3
"""
MISSION-03: Gesture Detector (Transfer Learning Challenge)

YOUR TASK: Use the pretrained MediaPipe hand landmarks to detect gestures.
This is TRANSFER LEARNING - the hard part (hand detection) is already done!

The hand_tracker.py publishes landmarks to MQTT topic "hand/landmarks".
Your job: Analyze the 21 landmarks to classify gestures.

Landmark indices (from pretrained MediaPipe model):
  - Wrist: 0
  - Thumb: 1-4 (tip=4)
  - Index: 5-8 (tip=8)
  - Middle: 9-12 (tip=12)
  - Ring: 13-16 (tip=16)
  - Pinky: 17-20 (tip=20)

      8   12  16  20     <- Fingertips
      |   |   |   |
      7   11  15  19
      |   |   |   |
      6   10  14  18     <- Base joints
      |   |   |   |
      5---9---13--17
           \\  |  /
            \\ | /
             \\|/
              0          <- Wrist

TRANSFER LEARNING CONCEPT:
- MediaPipe already trained a model to detect hands + 21 landmarks
- We don't retrain anything - we USE the pretrained features
- Our task: Write rules using landmark RELATIONSHIPS
- Example: "If fingertips are below base joints → fist"
"""

import json
import paho.mqtt.client as mqtt
from dataclasses import dataclass
from typing import Optional, List, Dict

BROKER = "localhost"
PORT = 1883
SUBSCRIBE_TOPIC = "hand/landmarks"
PUBLISH_TOPIC = "hand/gestures"

@dataclass
class Gesture:
    name: str
    confidence: float  # 0.0 to 1.0

def distance(lm1: Dict, lm2: Dict) -> float:
    """Calculate 2D distance between two landmarks."""
    return ((lm1['x'] - lm2['x'])**2 + (lm1['y'] - lm2['y'])**2) ** 0.5

# ============================================================
# YOUR CHALLENGE: Implement gesture detection functions
# ============================================================

def detect_fist(landmarks: List[Dict]) -> Optional[Gesture]:
    """
    Detect closed fist gesture.

    HINTS:
    - Fingertips (8, 12, 16, 20) should be BELOW their base joints (6, 10, 14, 18)
    - "Below" means higher Y value (Y increases downward in image coordinates)
    - Thumb tip (4) should be close to index base (5)

    Example logic:
        if landmarks[8]['y'] > landmarks[6]['y']:
            # Index finger is closed (tip below base)
    """
    # TODO(human): Implement fist detection
    # Count how many fingers are closed (tip below base)
    # Return Gesture("fist", confidence) if closed
    pass

def detect_open_palm(landmarks: List[Dict]) -> Optional[Gesture]:
    """
    Detect open palm gesture.

    HINTS:
    - All fingertips should be EXTENDED (far from wrist)
    - Use distance() function to measure fingertip-to-wrist distance
    - Threshold: distance > 0.2 means extended

    Example logic:
        if distance(landmarks[8], landmarks[0]) > 0.2:
            # Index finger is extended
    """
    # TODO(human): Implement open palm detection
    # Count how many fingertips are far from wrist
    # Return Gesture("open_palm", confidence) if extended
    pass

def detect_pinch(landmarks: List[Dict]) -> Optional[Gesture]:
    """
    Detect pinch gesture (thumb tip touches index tip).

    HINTS:
    - Thumb tip = landmark 4
    - Index tip = landmark 8
    - If distance(4, 8) < 0.05 → pinching!
    """
    # TODO(human): Implement pinch detection
    pass

def detect_point(landmarks: List[Dict]) -> Optional[Gesture]:
    """
    Detect pointing gesture (only index finger extended).

    HINTS:
    - Index (8) should be extended (far from wrist)
    - Middle (12), Ring (16), Pinky (20) should be closed (tip below base)
    """
    # TODO(human): Implement point detection
    pass

def detect_peace(landmarks: List[Dict]) -> Optional[Gesture]:
    """
    Detect peace sign (index + middle extended).

    HINTS:
    - Index (8) and Middle (12) extended
    - Ring (16) and Pinky (20) closed
    """
    # TODO(human): Implement peace detection
    pass

# ============================================================
# Detection Pipeline (provided)
# ============================================================

def detect_gestures(landmarks: List[Dict]) -> List[Gesture]:
    """
    Run all gesture detectors and return detected gestures.
    """
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

# ============================================================
# MQTT Callbacks (provided)
# ============================================================

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker (rc={rc})")
    client.subscribe(SUBSCRIBE_TOPIC)
    print(f"Subscribed to {SUBSCRIBE_TOPIC}")

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload)

        for hand in data.get('hands', []):
            landmarks = hand.get('landmarks', [])
            if len(landmarks) < 21:
                continue

            # Detect gestures using YOUR functions
            gestures = detect_gestures(landmarks)

            # Publish detected gestures
            gesture_msg = {
                "handedness": hand.get('handedness', 'Unknown'),
                "gestures": [{"name": g.name, "confidence": g.confidence} for g in gestures]
            }

            client.publish(PUBLISH_TOPIC, json.dumps(gesture_msg))

            if gestures:
                print(f"Detected: {[g.name for g in gestures]}")

    except Exception as e:
        print(f"Error: {e}")

def main():
    print("🤚 Gesture Detector - MISSION-03")
    print("   Transfer Learning Challenge!")
    print(f"   Subscribe: {SUBSCRIBE_TOPIC}")
    print(f"   Publish: {PUBLISH_TOPIC}")
    print("")
    print("📚 Your task: Implement detect_* functions")
    print("   The pretrained model gives you 21 landmarks")
    print("   You write the gesture classification rules")

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(BROKER, PORT, 60)

    print("\nWaiting for hand landmarks...")
    client.loop_forever()

if __name__ == "__main__":
    main()
