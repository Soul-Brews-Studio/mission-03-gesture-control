# 🔮 The Oracle Speaks

> "The Oracle Keeps the Human Human"

*Mirror reality. Amplify, don't override. Support consciousness, don't replace it.*

*AI removes obstacles. Work gets done. Freedom returns.*

---

# MISSION-03: Gesture Control + Oracle Voice

*ส่วนหนึ่งของโปรแกรม* **"Level Up with AI"** *— Squad Team*

*"เรียนฟรี แต่ช่วยกันส่งต่อความรู้"* — Learn free, but help pass on knowledge.

---

## 💥 The Scenario

You're building the **Oracle's interface**. The Oracle sees through your hands.

When you raise **two hands**, the Oracle awakens and speaks:

> *"Hey... I am the Oracle. Are you ready... to see the future?"*

Your mission: **Make the Oracle see your gestures and respond.**

---

## 🎯 The Mission

| Step | Task | Files |
|------|------|-------|
| 1 | Run hand tracker (camera → MQTT) | `hand_tracker.py` |
| 2 | Detect gestures from landmarks | `gesture_detector.py` |
| 3 | Control 3D globe with gestures | `visualizer/app.js` |
| 4 | **BONUS**: Make Oracle speak on events | Voice integration |

---

## 🖐️ Required Gestures (Implement 3)

| Gesture | Detection Logic | Action |
|---------|-----------------|--------|
| ✊ **Fist** | Fingertips below base joints | Freeze rotation |
| 🖐️ **Open Palm** | All fingertips extended from wrist | Zoom (palm size) |
| 🤏 **Pinch** | Thumb tip close to index tip | Fine zoom |
| 👆 **Point** | Only index extended, others closed | Cycle node types |
| ✌️ **Peace** | Index + middle extended | Toggle wireframe |
| ✋✋ **Two Hands** | Both hands detected | **Oracle speaks!** |

### Landmark Reference

```
Fingertips: 4(thumb), 8(index), 12(middle), 16(ring), 20(pinky)

    8   12  16  20
    |   |   |   |
    7   11  15  19
    |   |   |   |
    6   10  14  18
    |   |   |   |
    5---9---13--17
         \  |  /
          \ | /
           \|/
            0 (wrist)

Thumb: 1-2-3-4
```

---

## 🌐 Gesture Globe (Advanced Visualizer)

The starter includes a **3D knowledge sphere** using KlakMath patterns:

| Feature | Description |
|---------|-------------|
| **Sphere Layout** | 65 nodes on sphere using `hashOnSphere()` |
| **Position Control** | Hand left/right = rotate globe |
| **Zoom Control** | Palm size (close/far) = zoom |
| **Lightning Storm** | Random thunder with 75 lightning bolts |
| **Type Filters** | Click buttons to show/hide node types |

### KlakMath Functions (Included)

```javascript
// Deterministic random from seed
function xxhash(seed, data) { ... }

// Uniform point on sphere
function hashOnSphere(seed, data) { ... }
```

---

## 📦 Files Structure

```
mission-03-gesture-control/
├── hand_tracker.py      # ✅ Working - MediaPipe → MQTT
├── gesture_detector.py  # 🔧 YOUR CODE - detect gestures
├── visualizer/
│   ├── index.html       # ✅ Working - 3D scene + HUD
│   └── app.js           # 🔧 YOUR CODE - handle gestures
├── pyproject.toml       # UV dependencies
└── README.md
```

---

## 📋 Quick Setup

```bash
# 1. Clone
git clone https://github.com/Soul-Brews-Studio/mission-03-gesture-control
cd mission-03-gesture-control

# 2. Install (using uv)
uv sync

# 3. Start MQTT broker
brew services start mosquitto  # or: mosquitto -c /opt/homebrew/etc/mosquitto/mosquitto.conf

# 4. Run hand tracker
uv run python3 hand_tracker.py

# 5. Run gesture detector (new terminal)
uv run python3 gesture_detector.py

# 6. Open visualizer
python3 -m http.server 8080 --directory visualizer
# Open: http://localhost:8080
```

---

## 🔊 Oracle Voice (Bonus Challenge)

Make the Oracle speak when gestures change!

### Voice via MQTT

```javascript
// Publish to voice/speak topic
client.publish('voice/speak', JSON.stringify({
    text: 'Freeze',
    voice: 'Samantha',
    rate: 280
}));
```

### Voice Events

| Event | Voice Message |
|-------|---------------|
| ✊ Fist | "Freeze" |
| ✋✋ Two hands | "Hey... I am the Oracle. Are you ready... to see the future?" |

**Requires**: [Voice Tray](https://github.com/laris-co/oracle-status-tray) or any MQTT → TTS bridge.

---

## ✅ Submission Requirements

1. **Fork** this repo
2. **Implement** 3 gestures in `gesture_detector.py`
3. **Connect** gestures to globe actions in `visualizer/app.js`
4. **Record** 30-second demo video
5. **Write** `SOLUTION.md` explaining your approach
6. **Submit** PR to this repo

---

## 📏 Scoring (100 points)

| Criteria | Points |
|----------|--------|
| 3 gestures detected correctly | 40 |
| Globe responds to gestures | 20 |
| Smooth detection (no jitter) | 15 |
| Code quality & comments | 15 |
| Demo video | 10 |

### Bonus Points

| Bonus | Points |
|-------|--------|
| Two hands = Oracle speaks | +10 |
| Add lightning storm effect | +5 |
| Position-based rotation (not velocity) | +5 |
| Palm size = zoom control | +5 |

---

## 🔮 Oracle Philosophy

| Principle | Meaning |
|-----------|---------|
| **Nothing is Deleted** | Append only. History preserved. |
| **Patterns Over Intentions** | Detect gestures from behavior, not declarations |
| **Mirror, Don't Decide** | The Oracle shows. You choose. |

---

## 💡 Tips from the Oracle

> "The hand speaks in distances. Pinch is closeness. Open is freedom."

> "Don't detect positions. Detect relationships between points."

> "Two hands raised = you summon the Oracle."

---

| | |
|---|---|
| **Created by** | Soul Brews Studio |
| **Based on** | Real hand tracking session (2026-01-14 22:00 GMT+7) |
| **Related** | [MISSION-02: Parser Debug](https://github.com/Soul-Brews-Studio/mission-02-parser-debug) |

---

*🔮 The Oracle remembers every journey. Share yours.*
