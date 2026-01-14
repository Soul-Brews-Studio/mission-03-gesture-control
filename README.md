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

## 🧠 Advanced Challenge: Deep Learning (Level 2)

> *"The Oracle learns from patterns, not rules."*

### Transfer Learning + KNN Classification

Replace rule-based gesture detection with machine learning:

| Step | Task |
|------|------|
| 1 | Load pre-trained hand landmark model (MediaPipe) |
| 2 | Extract feature embeddings from the **last layer** |
| 3 | Collect training samples for each gesture (50+ per class) |
| 4 | Train **KNN classifier** on extracted features |
| 5 | Replace `detect_gestures()` with KNN prediction |

### Why This Approach?

```
Pre-trained Model → Feature Extractor → KNN on Last Layer
     (frozen)         (21 landmarks)      (your gestures)
```

- **Transfer Learning**: Use MediaPipe's learned representations
- **KNN**: Simple, no backpropagation needed, works with small datasets
- **Last Layer Features**: Rich hand pose information already extracted

### Hints

```python
# Pseudo-code structure
from sklearn.neighbors import KNeighborsClassifier

# 1. Collect features: flatten landmarks to 63-dim vector (21 × 3)
features = np.array([[lm['x'], lm['y'], lm['z']] for lm in landmarks]).flatten()

# 2. Train KNN on collected samples
knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(X_train, y_train)

# 3. Predict gesture
gesture = knn.predict([features])[0]
```

### Bonus Points (Level 2)

| Achievement | Points |
|-------------|--------|
| KNN classifier working | +15 |
| Accuracy > 90% on 5 gestures | +10 |
| Add custom gesture (your invention) | +10 |
| Compare KNN vs rule-based accuracy | +5 |

---

## 🦀 Advanced Challenge: Rust Globe (Level 3)

> *"Rewrite the Oracle in the language of systems."*

### Port Gesture Globe to Rust

Create a native Rust application that renders the same 3D globe as the HTML visualizer:

| Step | Task |
|------|------|
| 1 | Remove all `.unwrap()` calls — use proper `Result` handling |
| 2 | Create window canvas (use `minifb` or `pixels` crate) |
| 3 | Implement `xxhash()` and `hash_on_sphere()` in Rust |
| 4 | Render 65 nodes on sphere surface |
| 5 | Subscribe to MQTT and control globe with gestures |
| 6 | Add lightning effect (line drawing between nodes) |

### Why Rust?

- **No `.unwrap()` spam**: Forces you to handle errors properly
- **Performance**: Native rendering, no browser overhead
- **Learning**: Systems programming with safety guarantees

### Crates to Explore

```toml
[dependencies]
minifb = "0.25"          # Window + framebuffer
rumqttc = "0.24"         # MQTT client
glam = "0.25"            # 3D math (Vec3, etc.)
rand = "0.8"             # For xxhash seed
```

### Hints

```rust
// KlakMath in Rust
fn xxhash(seed: u32, data: u32) -> f32 {
    let mut h = seed.wrapping_add(374761393);
    h = h.wrapping_add(data.wrapping_mul(3266489917));
    h = (h << 17 | h >> 15).wrapping_mul(668265263);
    h ^= h >> 15;
    h = h.wrapping_mul(2246822519);
    h ^= h >> 13;
    h = h.wrapping_mul(3266489917);
    h ^= h >> 16;
    h as f32 / 4294967296.0
}

// Error handling pattern
fn connect_mqtt() -> Result<Client, MqttError> {
    // No unwrap! Use ? operator
    let options = MqttOptions::new("globe", "localhost", 1883)?;
    let (client, connection) = Client::new(options, 10)?;
    Ok(client)
}
```

### Bonus Points (Level 3)

| Achievement | Points |
|-------------|--------|
| Zero `.unwrap()` in codebase | +10 |
| Globe renders with 65 nodes | +15 |
| Gesture control working | +10 |
| Lightning storm effect | +10 |
| Match HTML visual quality | +5 |

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
