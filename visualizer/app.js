/**
 * MISSION-03: Gesture Globe Visualizer
 *
 * KlakMath-inspired sphere layout with gesture controls.
 * - Fist/Palm: Zoom in/out
 * - Hand tracking: Swipe to rotate globe
 */

// ============================================================
// KlakMath: Deterministic Random Functions
// ============================================================

function xxhash(seed, data) {
    let h = ((seed + 374761393) >>> 0);
    h = ((h + (data * 3266489917 >>> 0)) >>> 0);
    h = ((((h << 17) | (h >>> 15)) * 668265263) >>> 0);
    h ^= h >>> 15;
    h = ((h * 2246822519) >>> 0);
    h ^= h >>> 13;
    h = ((h * 3266489917) >>> 0);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function hashOnSphere(seed, data) {
    const phi = xxhash(seed, data) * Math.PI * 2;
    const cosTheta = xxhash(seed, data + 0x10000000) * 2 - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    return new THREE.Vector3(
        sinTheta * Math.cos(phi),
        sinTheta * Math.sin(phi),
        cosTheta
    );
}

// ============================================================
// Three.js Setup
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a14);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x606080, 0.8);
scene.add(ambientLight);

const directLight = new THREE.DirectionalLight(0xffffff, 1.2);
directLight.position.set(5, 5, 5);
scene.add(directLight);

const rimLight = new THREE.PointLight(0xa78bfa, 0.5, 30);
scene.add(rimLight);

camera.position.z = 8;

// ============================================================
// Node Types & Colors
// ============================================================

const NODE_TYPES = {
    data:   { color: 0x4ade80, count: 20 },
    event:  { color: 0xf472b6, count: 15 },
    action: { color: 0x60a5fa, count: 12 },
    state:  { color: 0xfbbf24, count: 10 },
    link:   { color: 0xa78bfa, count: 8 },
};

// ============================================================
// Globe State
// ============================================================

let globeGroup = new THREE.Group();
scene.add(globeGroup);

let nodes = [];
let lightnings = [];       // Normal ambient lightnings (always visible)
let stormLightnings = [];  // Extra lightnings during thunder only
let zoomLevel = 8;
let wireframeMode = false;

// Thunder storm state
let thunderTimer = 0;
let thunderActive = false;
let thunderFlash = 0;
const THUNDER_INTERVAL = 5;  // Seconds between storms

// Hand tracking state
let handX = 0.5;           // Current hand X position (0-1)
let rotationSpeed = 0;     // Current rotation speed (negative=left, positive=right)
let currentGesture = 'none';
let handsCount = 0;        // Number of hands detected

// ============================================================
// CHALLENGE: Voice Announcements
// ============================================================
// YOUR TASK: Add voice feedback when gestures change
//
// Hints:
// 1. Publish to MQTT topic "voice/speak" with JSON:
//    { "text": "Freeze", "voice": "Samantha", "rate": 200 }
//
// 2. Only announce on CHANGE (don't spam same message)
//
// 3. Add cooldown (3 seconds) to prevent rapid repeats
//
// Gesture ideas:
// - Fist → "Freeze"
// - Two hands → "Hey, I am the Oracle..."
// - Point → "Next"
// ============================================================
let lastVoiceGesture = ''; // TODO(human): Track last announced gesture
let lastVoiceTime = 0;     // TODO(human): Track time for cooldown

// Palm size tracking for zoom
let palmSizeSmooth = 0.2;
const PALM_SIZE_MIN = 0.1;   // Far away
const PALM_SIZE_MAX = 0.4;   // Close up

// Rotation speed multiplier
const MAX_ROTATION_SPEED = 0.05;

const filters = {
    data: true,
    event: true,
    action: true,
    state: true,
    link: true,
};

// ============================================================
// Create Nodes on Sphere
// ============================================================

function createGlobe() {
    while (globeGroup.children.length > 0) {
        globeGroup.remove(globeGroup.children[0]);
    }
    nodes = [];

    // Wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(3, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x333366,
        wireframe: true,
        transparent: true,
        opacity: 0.1
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(sphereMesh);

    let nodeIndex = 0;
    const SPHERE_RADIUS = 3;

    Object.entries(NODE_TYPES).forEach(([type, config]) => {
        for (let i = 0; i < config.count; i++) {
            const pos = hashOnSphere(42, nodeIndex).multiplyScalar(SPHERE_RADIUS);

            const geo = new THREE.SphereGeometry(0.08, 16, 16);
            const mat = new THREE.MeshStandardMaterial({
                color: config.color,
                metalness: 0.3,
                roughness: 0.4,
                emissive: config.color,
                emissiveIntensity: 0.15,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.userData = { type, index: nodeIndex };

            globeGroup.add(mesh);
            nodes.push({ mesh, type, originalPos: pos.clone() });

            nodeIndex++;
        }
    });

    document.getElementById('nodeCount').textContent = nodes.length;

    // Create lightning connections
    createLightnings();
}

// ============================================================
// Lightning Connections
// ============================================================

function createLightningPath(start, end, segments = 8) {
    const points = [];
    const direction = end.clone().sub(start);
    const length = direction.length();
    direction.normalize();

    // Perpendicular vectors for displacement
    const up = new THREE.Vector3(0, 1, 0);
    const perp1 = direction.clone().cross(up).normalize();
    const perp2 = direction.clone().cross(perp1).normalize();

    points.push(start.clone());

    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const basePoint = start.clone().lerp(end, t);

        // Random displacement (jagged lightning effect)
        const displacement = (Math.random() - 0.5) * length * 0.15;
        const displacement2 = (Math.random() - 0.5) * length * 0.15;

        basePoint.add(perp1.clone().multiplyScalar(displacement));
        basePoint.add(perp2.clone().multiplyScalar(displacement2));

        points.push(basePoint);
    }

    points.push(end.clone());
    return points;
}

function createLightnings() {
    // Clear existing lightnings
    lightnings.forEach(l => globeGroup.remove(l.line));
    lightnings = [];
    stormLightnings.forEach(l => globeGroup.remove(l.line));
    stormLightnings = [];

    const maxDistance = 2.0;

    // Create ALL possible connections
    const allPairs = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dist = nodes[i].originalPos.distanceTo(nodes[j].originalPos);
            if (dist < maxDistance) {
                allPairs.push({ i, j, dist });
            }
        }
    }

    // Shuffle pairs
    allPairs.sort(() => Math.random() - 0.5);

    // First 15 = always visible (ambient)
    // Next 60 = storm only
    allPairs.slice(0, 15).forEach(pair => {
        const lightning = createLightningLine(pair.i, pair.j, 0x88ccff, 0.4);
        lightnings.push(lightning);
    });

    allPairs.slice(15, 75).forEach(pair => {
        const lightning = createLightningLine(pair.i, pair.j, 0xaaddff, 0.0);
        lightning.line.visible = false;  // Hidden by default
        stormLightnings.push(lightning);
    });
}

function createLightningLine(nodeAIdx, nodeBIdx, color, opacity) {
    const points = createLightningPath(
        nodes[nodeAIdx].originalPos,
        nodes[nodeBIdx].originalPos,
        6
    );

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending
    });

    const line = new THREE.Line(geometry, material);
    globeGroup.add(line);

    return {
        line,
        nodeA: nodeAIdx,
        nodeB: nodeBIdx,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5
    };
}

function updateLightnings(time) {
    // === AMBIENT LIGHTNINGS (always visible, subtle) ===
    lightnings.forEach(lightning => {
        const { line, nodeA, nodeB, phase, speed } = lightning;

        const nodesVisible = nodes[nodeA].mesh.visible && nodes[nodeB].mesh.visible;
        line.visible = nodesVisible;

        if (!nodesVisible) return;

        // Normal subtle flicker
        if (Math.random() < 0.1) {
            const start = nodes[nodeA].mesh.position;
            const end = nodes[nodeB].mesh.position;
            const newPoints = createLightningPath(start, end, 6);
            line.geometry.setFromPoints(newPoints);
        }

        // During thunder: ambient ones also go bright
        if (thunderFlash > 0.3) {
            line.material.opacity = 0.8 + thunderFlash * 0.2;
            line.material.color.setHex(0xffffff);
        } else {
            // Normal pulsing
            const pulse = Math.sin(time * speed + phase) * 0.5 + 0.5;
            line.material.opacity = 0.2 + pulse * 0.3;
            line.material.color.setHex(0x88ccff);
        }
    });

    // === STORM LIGHTNINGS (only during thunder) ===
    stormLightnings.forEach(lightning => {
        const { line, nodeA, nodeB } = lightning;

        const nodesVisible = nodes[nodeA].mesh.visible && nodes[nodeB].mesh.visible;

        // Only show during thunder
        if (!thunderActive || !nodesVisible) {
            line.visible = false;
            return;
        }

        line.visible = true;

        // Rapid flicker during storm
        if (Math.random() < 0.7) {
            const start = nodes[nodeA].mesh.position;
            const end = nodes[nodeB].mesh.position;
            const newPoints = createLightningPath(start, end, 10);
            line.geometry.setFromPoints(newPoints);
        }

        // Bright white flash
        if (thunderFlash > 0.5) {
            line.material.opacity = 1.0;
            line.material.color.setHex(0xffffff);
        } else {
            line.material.opacity = 0.5 + thunderFlash * 0.5;
            line.material.color.setHex(0xccddff);
        }
    });
}

function triggerThunder() {
    thunderActive = true;
    thunderFlash = 1.0;

    // Flash all nodes bright
    nodes.forEach(node => {
        node.mesh.material.emissiveIntensity = 0.8;
    });

    // Force ALL lightnings to regenerate at once (synchronized flash)
    lightnings.forEach(lightning => {
        const { line, nodeA, nodeB } = lightning;
        const start = nodes[nodeA].mesh.position;
        const end = nodes[nodeB].mesh.position;
        const newPoints = createLightningPath(start, end, 10);
        line.geometry.setFromPoints(newPoints);
    });

    // Multi-flash effect (flicker 2-3 times)
    setTimeout(() => { thunderFlash = 0.8; }, 50);
    setTimeout(() => { thunderFlash = 1.0; }, 100);
    setTimeout(() => { thunderFlash = 0.6; }, 150);

    // End thunder after short duration
    setTimeout(() => {
        thunderActive = false;
        nodes.forEach(node => {
            node.mesh.material.emissiveIntensity = 0.15;
        });
    }, 400);
}

function updateThunder(time, deltaTime) {
    thunderTimer += deltaTime;

    // Random thunder every ~5 seconds (with some variance)
    if (thunderTimer > THUNDER_INTERVAL + Math.random() * 3) {
        triggerThunder();
        thunderTimer = 0;
    }

    // Flash decay
    if (thunderFlash > 0) {
        thunderFlash *= 0.9;
        scene.background.setRGB(
            0.04 + thunderFlash * 0.3,
            0.04 + thunderFlash * 0.3,
            0.06 + thunderFlash * 0.4
        );
    } else {
        scene.background.setHex(0x0a0a14);
    }
}

// ============================================================
// Filter System
// ============================================================

function updateFilters() {
    let visibleCount = 0;
    nodes.forEach(node => {
        const visible = filters[node.type];
        node.mesh.visible = visible;
        if (visible) visibleCount++;
    });
    document.getElementById('nodeCount').textContent = visibleCount;
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        filters[type] = !filters[type];
        btn.classList.toggle('active', filters[type]);
        btn.classList.toggle('inactive', !filters[type]);
        updateFilters();
    });
});

// ============================================================
// Hand Position Tracking (position = rotation, size = zoom)
// ============================================================

function distance2D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleHandPosition(landmarks) {
    if (!landmarks || landmarks.length < 21) return;

    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const pinkyTip = landmarks[20];
    const thumbTip = landmarks[4];

    // === POSITION-BASED ROTATION ===
    // Hand X position: 0 = right of screen, 1 = left of screen (mirrored camera)
    handX = (wrist.x + middleTip.x) / 2;

    // Offset from center (0.5)
    // Positive = hand is left of center → rotate left
    // Negative = hand is right of center → rotate right
    const offsetFromCenter = handX - 0.5;

    // Speed proportional to distance from center (squared for more control near center)
    rotationSpeed = offsetFromCenter * Math.abs(offsetFromCenter) * MAX_ROTATION_SPEED * 4;

    // === PALM SIZE: Distance for zoom ===
    const palmHeight = distance2D(wrist, middleTip);
    const palmWidth = distance2D(thumbTip, pinkyTip);
    const palmSize = (palmHeight + palmWidth) / 2;

    // Smooth the palm size
    palmSizeSmooth += (palmSize - palmSizeSmooth) * 0.2;

    // Map palm size to zoom
    const normalizedSize = (palmSizeSmooth - PALM_SIZE_MIN) / (PALM_SIZE_MAX - PALM_SIZE_MIN);
    const clampedSize = Math.max(0, Math.min(1, normalizedSize));
    zoomLevel = 12 - (clampedSize * 8);

    // Update HUD
    const speedPercent = Math.round(Math.abs(offsetFromCenter) * 200);
    const direction = offsetFromCenter > 0.05 ? `← ${speedPercent}%` :
                      offsetFromCenter < -0.05 ? `${speedPercent}% →` : 'Center';
    document.getElementById('rotSpeed').textContent = direction;

    const zoomPercent = Math.round((8 / zoomLevel) * 100);
    document.getElementById('zoomLevel').textContent = zoomPercent + '%';
}

// ============================================================
// Gesture Handler
// ============================================================

// TODO(human): Implement voice announcement function
// function announceVoice(text) {
//     // 1. Check cooldown (3s) - don't repeat same message
//     // 2. Update lastVoiceGesture and lastVoiceTime
//     // 3. Publish to MQTT topic "voice/speak"
//     //    Example: client.publish('voice/speak', JSON.stringify({
//     //        text: text, voice: 'Samantha', rate: 200
//     //    }));
// }

function handleGesture(gestureName, confidence) {
    const gestureDisplay = document.getElementById('gesture');
    gestureDisplay.textContent = `${gestureName} (${(confidence * 100).toFixed(0)}%)`;

    currentGesture = gestureName;

    switch (gestureName) {
        case 'fist':
            // ✊ Stop rotation
            rotationSpeed = 0;
            // TODO(human): announceVoice('Freeze');
            break;

        case 'open_palm':
            // 🖐️ Palm size controls zoom automatically
            // (handled in handleHandPosition)
            break;

        case 'pinch':
            // 🤏 Lock current zoom (disable palm size tracking temporarily)
            // Just show current state
            break;

        case 'point':
            // 👆 Cycle node type visibility
            const types = Object.keys(filters);
            const activeTypes = types.filter(t => filters[t]);
            if (activeTypes.length === types.length) {
                // All visible → show only first type
                types.forEach(t => filters[t] = false);
                filters['data'] = true;
            } else {
                // Cycle to next type
                const currentType = types.find(t => filters[t]);
                const nextIndex = (types.indexOf(currentType) + 1) % types.length;
                types.forEach(t => filters[t] = false);
                filters[types[nextIndex]] = true;
            }
            updateFilters();
            // Update button states
            document.querySelectorAll('.filter-btn').forEach(btn => {
                const type = btn.dataset.type;
                btn.classList.toggle('active', filters[type]);
                btn.classList.toggle('inactive', !filters[type]);
            });
            break;

        case 'peace':
            // ✌️ Show all / toggle wireframe
            const allVisible = Object.values(filters).every(v => v);
            if (!allVisible) {
                // Show all
                Object.keys(filters).forEach(t => filters[t] = true);
                updateFilters();
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.add('active');
                    btn.classList.remove('inactive');
                });
            } else {
                // Toggle wireframe on nodes
                wireframeMode = !wireframeMode;
                nodes.forEach(node => {
                    node.mesh.material.wireframe = wireframeMode;
                });
            }
            break;
    }

    // Update HUD
    const zoomPercent = Math.round((8 / zoomLevel) * 100);
    document.getElementById('zoomLevel').textContent = zoomPercent + '%';
}

// ============================================================
// MQTT Connection (dual topics)
// ============================================================

const BROKER = 'ws://localhost:9001';
const GESTURE_TOPIC = 'hand/gestures';
const LANDMARK_TOPIC = 'hand/landmarks';

let client = null;

function connectMQTT() {
    const statusDisplay = document.getElementById('status');

    try {
        client = mqtt.connect(BROKER);

        client.on('connect', () => {
            console.log('Connected to MQTT');
            statusDisplay.textContent = 'Connected';
            statusDisplay.className = 'connected';
            client.subscribe(GESTURE_TOPIC);
            client.subscribe(LANDMARK_TOPIC);
        });

        client.on('message', (topic, message) => {
            try {
                const data = JSON.parse(message.toString());

                if (topic === GESTURE_TOPIC) {
                    // Handle gestures
                    const gestures = data.gestures || [];
                    if (gestures.length > 0) {
                        const best = gestures.reduce((a, b) =>
                            a.confidence > b.confidence ? a : b
                        );
                        handleGesture(best.name, best.confidence);
                    } else {
                        document.getElementById('gesture').textContent = 'No gesture';
                        currentGesture = 'none';
                        // Don't reset voice - 3s cooldown handles it
                    }
                } else if (topic === LANDMARK_TOPIC) {
                    // Handle hand position for swipe
                    const hands = data.hands || [];
                    const prevHandsCount = handsCount;
                    handsCount = hands.length;

                    // Two hands = STOP rotation
                    if (handsCount >= 2) {
                        rotationSpeed = 0;
                        document.getElementById('rotSpeed').textContent = '✋✋ STOP';
                        // TODO(human): Add Oracle greeting voice here!
                        // Hint: "Hey, I am the Oracle. Are you ready to see the future?"
                        // Use slower rate (180) for dramatic effect
                    } else if (hands.length === 1) {
                        handleHandPosition(hands[0].landmarks);
                    }
                    // 3s cooldown handles deduplication - no reset needed
                }
            } catch (e) {
                console.error('Parse error:', e);
            }
        });

        client.on('error', (err) => {
            console.error('MQTT error:', err);
            statusDisplay.textContent = 'Error';
            statusDisplay.className = 'disconnected';
        });

        client.on('close', () => {
            statusDisplay.textContent = 'Disconnected';
            statusDisplay.className = 'disconnected';
        });

    } catch (e) {
        console.error('Connection failed:', e);
        statusDisplay.textContent = 'Failed';
    }
}

// ============================================================
// Animation Loop
// ============================================================

let lastTime = Date.now() * 0.001;

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;
    const deltaTime = time - lastTime;
    lastTime = time;

    // Position-based rotation
    globeGroup.rotation.y += rotationSpeed;

    // Smooth zoom
    camera.position.z += (zoomLevel - camera.position.z) * 0.1;

    // Node breathing effect
    nodes.forEach((node, i) => {
        if (node.mesh.visible) {
            const scale = 1 + Math.sin(time * 2 + i * 0.5) * 0.1;
            node.mesh.scale.setScalar(scale);
        }
    });

    // Lightning animation
    updateLightnings(time);

    // Thunder storm
    updateThunder(time, deltaTime);

    renderer.render(scene, camera);
}

// ============================================================
// Window Resize
// ============================================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// Start
// ============================================================

createGlobe();
connectMQTT();
animate();

console.log('🌐 Gesture Globe ready!');
console.log('📡 Gestures:', GESTURE_TOPIC);
console.log('🖐️ Landmarks:', LANDMARK_TOPIC);
console.log('');
console.log('Controls:');
console.log('  🖐️ Close/Far → Zoom in/out');
console.log('  ← Hand Left → Spin left (faster at edge)');
console.log('  → Hand Right → Spin right (faster at edge)');
console.log('  Center → Slow down');
console.log('  ✊ Fist → Stop');
console.log('  👆 Point → Cycle types');
