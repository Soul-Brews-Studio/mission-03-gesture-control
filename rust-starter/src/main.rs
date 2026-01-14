// Hand Tracker - MQTT Receiver + Animated Visualization
// Transfer learning from Three.js Globe to Rust Canvas
// - KNN gesture detection
// - Lightning animation
// - No unwrap() - proper error handling

use anyhow::{Context, Result};
use clap::Parser;
use minifb::{Key, Window, WindowOptions};
use rumqttc::{Client, Event, MqttOptions, Packet, QoS};
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const WIDTH: usize = 640;
const HEIGHT: usize = 480;

// Hand skeleton connections (21 landmarks)
const CONNECTIONS: [(usize, usize); 21] = [
    (0, 1), (1, 2), (2, 3), (3, 4),       // Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),       // Index
    (0, 9), (9, 10), (10, 11), (11, 12),  // Middle
    (0, 13), (13, 14), (14, 15), (15, 16),// Ring
    (0, 17), (17, 18), (18, 19), (19, 20),// Pinky
    (5, 9),                                // Palm
];

// Gesture templates for KNN (normalized landmark distances)
#[derive(Clone)]
struct GestureTemplate {
    name: &'static str,
    features: [f32; 5], // [thumb_ext, index_ext, middle_ext, ring_ext, pinky_ext]
}

const GESTURE_TEMPLATES: [GestureTemplate; 5] = [
    GestureTemplate { name: "fist",      features: [0.0, 0.0, 0.0, 0.0, 0.0] },
    GestureTemplate { name: "open_palm", features: [1.0, 1.0, 1.0, 1.0, 1.0] },
    GestureTemplate { name: "point",     features: [0.0, 1.0, 0.0, 0.0, 0.0] },
    GestureTemplate { name: "peace",     features: [0.0, 1.0, 1.0, 0.0, 0.0] },
    GestureTemplate { name: "pinch",     features: [0.5, 0.5, 1.0, 1.0, 1.0] },
];

#[derive(Parser)]
#[command(name = "gesture-globe")]
struct Args {
    #[arg(short, long, default_value = "localhost")]
    broker: String,
    #[arg(short, long, default_value = "1883")]
    port: u16,
    #[arg(short, long, default_value = "hand/landmarks")]
    topic: String,
}

#[derive(Deserialize, Debug, Clone)]
struct Landmark {
    x: f32,
    y: f32,
    #[allow(dead_code)]
    z: f32,
}

#[derive(Deserialize, Debug, Clone)]
struct Hand {
    handedness: String,
    landmarks: Vec<Landmark>,
}

#[derive(Deserialize, Debug, Clone)]
#[allow(dead_code)]
struct HandMessage {
    timestamp: u64,
    hands: Vec<Hand>,
}

// Animation state (transfer learning from Three.js)
struct AnimationState {
    time: f32,
    lightning_active: bool,
    lightning_timer: f32,
    detected_gesture: String,
}

impl AnimationState {
    fn new() -> Self {
        Self {
            time: 0.0,
            lightning_active: false,
            lightning_timer: 0.0,
            detected_gesture: "none".to_string(),
        }
    }

    fn update(&mut self, dt: f32) {
        self.time += dt;
        self.lightning_timer += dt;

        // Thunder every 5-8 seconds
        if self.lightning_timer > 5.0 + (self.time.sin() * 1.5) {
            self.lightning_active = true;
            self.lightning_timer = 0.0;
        }

        // Lightning lasts 0.3 seconds
        if self.lightning_active && self.lightning_timer > 0.3 {
            self.lightning_active = false;
        }
    }
}

// KNN gesture detection
fn detect_gesture_knn(landmarks: &[Landmark]) -> Option<&'static str> {
    if landmarks.len() < 21 {
        return None;
    }

    // Extract features: finger extension ratios
    let wrist = &landmarks[0];

    // Calculate distances from wrist to fingertips
    let thumb_dist = distance(&landmarks[4], wrist);
    let index_dist = distance(&landmarks[8], wrist);
    let middle_dist = distance(&landmarks[12], wrist);
    let ring_dist = distance(&landmarks[16], wrist);
    let pinky_dist = distance(&landmarks[20], wrist);

    // Normalize (typical max distance is ~0.3 in normalized coords)
    let normalize = |d: f32| (d / 0.3).min(1.0);
    let features = [
        normalize(thumb_dist),
        normalize(index_dist),
        normalize(middle_dist),
        normalize(ring_dist),
        normalize(pinky_dist),
    ];

    // KNN: Find nearest template (k=1)
    let mut best_match = "unknown";
    let mut best_distance = f32::MAX;

    for template in &GESTURE_TEMPLATES {
        let dist = euclidean_distance(&features, &template.features);
        if dist < best_distance {
            best_distance = dist;
            best_match = template.name;
        }
    }

    // Only return if confident (distance < 0.5)
    if best_distance < 0.5 {
        Some(best_match)
    } else {
        None
    }
}

fn distance(a: &Landmark, b: &Landmark) -> f32 {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    (dx * dx + dy * dy).sqrt()
}

fn euclidean_distance(a: &[f32; 5], b: &[f32; 5]) -> f32 {
    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
}

// ============================================================
// TODO(squad): Implement KlakMath functions for sphere layout
// ============================================================

/// KlakMath xxhash - deterministic random from seed
/// Port from JavaScript:
/// ```javascript
/// function xxhash(seed, data) {
///     let h = ((seed + 374761393) >>> 0);
///     h = ((h + (data * 3266489917 >>> 0)) >>> 0);
///     h = ((((h << 17) | (h >>> 15)) * 668265263) >>> 0);
///     h ^= h >>> 15;
///     h = ((h * 2246822519) >>> 0);
///     h ^= h >>> 13;
///     h = ((h * 3266489917) >>> 0);
///     h ^= h >>> 16;
///     return (h >>> 0) / 4294967296;
/// }
/// ```
fn xxhash(_seed: u32, _data: u32) -> f32 {
    // TODO(squad): Implement xxhash using wrapping_add, wrapping_mul
    // Hint: Use .wrapping_add() and .wrapping_mul() for u32 overflow
    0.0
}

/// KlakMath hashOnSphere - uniform point distribution on sphere
/// Port from JavaScript:
/// ```javascript
/// function hashOnSphere(seed, data) {
///     const phi = xxhash(seed, data) * Math.PI * 2;
///     const cosTheta = xxhash(seed, data + 0x10000000) * 2 - 1;
///     const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
///     return new THREE.Vector3(
///         sinTheta * Math.cos(phi),
///         sinTheta * Math.sin(phi),
///         cosTheta
///     );
/// }
/// ```
fn hash_on_sphere(_seed: u32, _data: u32) -> (f32, f32, f32) {
    // TODO(squad): Implement using xxhash
    // Returns (x, y, z) on unit sphere
    (0.0, 0.0, 1.0)
}

// ============================================================
// Drawing functions
// ============================================================

fn draw_circle(buffer: &mut [u32], cx: i32, cy: i32, r: i32, color: u32) {
    let r2 = r * r;
    for dy in -r..=r {
        for dx in -r..=r {
            if dx * dx + dy * dy <= r2 {
                let px = cx + dx;
                let py = cy + dy;
                if px >= 0 && px < WIDTH as i32 && py >= 0 && py < HEIGHT as i32 {
                    buffer[py as usize * WIDTH + px as usize] = color;
                }
            }
        }
    }
}

fn draw_line(buffer: &mut [u32], x1: i32, y1: i32, x2: i32, y2: i32, color: u32, thickness: i32) {
    let dx = (x2 - x1).abs();
    let dy = -(y2 - y1).abs();
    let sx = if x1 < x2 { 1 } else { -1 };
    let sy = if y1 < y2 { 1 } else { -1 };
    let mut err = dx + dy;
    let mut x = x1;
    let mut y = y1;

    loop {
        for t in -thickness/2..=thickness/2 {
            let px = x + t;
            let py = y;
            if px >= 0 && px < WIDTH as i32 && py >= 0 && py < HEIGHT as i32 {
                buffer[py as usize * WIDTH + px as usize] = color;
            }
            let px = x;
            let py = y + t;
            if px >= 0 && px < WIDTH as i32 && py >= 0 && py < HEIGHT as i32 {
                buffer[py as usize * WIDTH + px as usize] = color;
            }
        }

        if x == x2 && y == y2 { break; }
        let e2 = 2 * err;
        if e2 >= dy { err += dy; x += sx; }
        if e2 <= dx { err += dx; y += sy; }
    }
}

// Lightning effect (transfer from Three.js)
fn draw_lightning(buffer: &mut [u32], x1: i32, y1: i32, x2: i32, y2: i32, time: f32) {
    let segments = 8;
    let mut points = Vec::with_capacity(segments + 1);
    points.push((x1 as f32, y1 as f32));

    for i in 1..segments {
        let t = i as f32 / segments as f32;
        let base_x = x1 as f32 + (x2 - x1) as f32 * t;
        let base_y = y1 as f32 + (y2 - y1) as f32 * t;

        // Random displacement using pseudo-random from time
        let noise = ((time * 100.0 + i as f32 * 17.3).sin() * 20.0) as f32;
        points.push((base_x + noise, base_y + noise * 0.5));
    }
    points.push((x2 as f32, y2 as f32));

    // Draw jagged line
    for i in 0..points.len() - 1 {
        draw_line(
            buffer,
            points[i].0 as i32,
            points[i].1 as i32,
            points[i + 1].0 as i32,
            points[i + 1].1 as i32,
            0xFFFFFFFF, // White lightning
            2,
        );
    }
}

// Draw gesture text indicator
fn draw_text_simple(buffer: &mut [u32], x: i32, y: i32, text: &str, color: u32) {
    let len = text.len() as i32;
    for i in 0..len {
        let px = x + i * 8;
        for dy in 0..10 {
            for dx in 0..6 {
                if px + dx >= 0 && px + dx < WIDTH as i32 && y + dy >= 0 && y + dy < HEIGHT as i32 {
                    buffer[(y + dy) as usize * WIDTH + (px + dx) as usize] = color;
                }
            }
        }
    }
}

// ============================================================
// TODO(squad): Add globe rendering here
// ============================================================
//
// fn draw_globe(buffer: &mut [u32], rotation: f32, zoom: f32) {
//     const NODE_COUNT: u32 = 65;
//     const SEED: u32 = 12345;
//
//     for i in 0..NODE_COUNT {
//         let (x, y, z) = hash_on_sphere(SEED, i);
//         // TODO: Apply rotation matrix
//         // TODO: Project 3D to 2D screen coords
//         // TODO: Draw node if z > 0 (front-facing)
//     }
// }

fn main() -> Result<()> {
    let args = Args::parse();

    println!("🖐️ Gesture Globe - Rust + MQTT");
    println!("   Window: {}x{}", WIDTH, HEIGHT);
    println!("   Broker: {}:{}", args.broker, args.port);
    println!("   Topic:  {}", args.topic);

    // Shared state for hand data
    let hands_data: Arc<Mutex<Vec<Hand>>> = Arc::new(Mutex::new(Vec::new()));
    let hands_clone = hands_data.clone();

    // MQTT setup - proper error handling with ?
    let mut mqtt_options = MqttOptions::new("gesture-globe-rust", &args.broker, args.port);
    mqtt_options.set_keep_alive(Duration::from_secs(5));
    let (client, mut connection) = Client::new(mqtt_options, 10);

    // Subscribe to topic
    client.subscribe(&args.topic, QoS::AtMostOnce)
        .context("Failed to subscribe to MQTT topic")?;
    println!("✅ Subscribed to {}", args.topic);

    // MQTT receiver thread - no unwrap, use if-let chains
    std::thread::spawn(move || {
        for notification in connection.iter() {
            if let Ok(Event::Incoming(Packet::Publish(publish))) = notification {
                if let Ok(msg) = serde_json::from_slice::<HandMessage>(&publish.payload) {
                    if let Ok(mut data) = hands_clone.lock() {
                        *data = msg.hands;
                    }
                }
            }
        }
    });

    // Window
    let mut window = Window::new(
        "🔮 Gesture Globe - Level 3 Challenge",
        WIDTH,
        HEIGHT,
        WindowOptions::default(),
    ).context("Failed to create window")?;
    window.set_target_fps(60);

    let mut buffer: Vec<u32> = vec![0; WIDTH * HEIGHT];
    let mut frame_count = 0u64;
    let mut last_fps_time = Instant::now();
    let mut current_fps = 0.0f32;
    let mut last_frame_time = Instant::now();

    // Animation state
    let mut anim = AnimationState::new();

    // Globe state
    let mut _rotation: f32 = 0.0;
    let mut _zoom: f32 = 1.0;

    println!("🎮 Press ESC to quit");
    println!("💡 Run: python hand_tracker.py (in another terminal)");
    println!("🔮 Gestures: fist, open_palm, point, peace, pinch");
    println!("");
    println!("📋 TODO(squad):");
    println!("   1. Implement xxhash() and hash_on_sphere()");
    println!("   2. Add draw_globe() function");
    println!("   3. Control rotation with hand X position");
    println!("   4. Control zoom with palm size");
    println!("   5. Add lightning between nodes");

    while window.is_open() && !window.is_key_down(Key::Escape) {
        // Delta time
        let dt = last_frame_time.elapsed().as_secs_f32();
        last_frame_time = Instant::now();

        // Update animation
        anim.update(dt);

        // Clear buffer (dark background)
        for pixel in buffer.iter_mut() {
            *pixel = 0xFF111122;
        }

        // Get hands from MQTT
        let hands = match hands_data.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => Vec::new(),
        };

        // TODO(squad): Use hand position to control globe
        // Example:
        // if let Some(hand) = hands.first() {
        //     let hand_x = hand.landmarks[0].x;  // 0.0 = left, 1.0 = right
        //     rotation += (hand_x - 0.5) * dt * 2.0;  // Position-based control
        // }

        // TODO(squad): Draw the globe here
        // draw_globe(&mut buffer, rotation, zoom);

        // Draw hand skeleton (for debugging)
        for hand in &hands {
            if hand.landmarks.len() < 21 {
                continue;
            }

            if let Some(gesture) = detect_gesture_knn(&hand.landmarks) {
                anim.detected_gesture = gesture.to_string();
            }

            let pts: Vec<(i32, i32)> = hand.landmarks.iter().map(|lm| {
                ((lm.x * WIDTH as f32) as i32, (lm.y * HEIGHT as f32) as i32)
            }).collect();

            // Draw lightning during thunder
            if anim.lightning_active {
                for tip in [4, 8, 12, 16, 20] {
                    let end_x = pts[tip].0 + ((anim.time * 5.0).sin() * 50.0) as i32;
                    let end_y = pts[tip].1 - 100;
                    draw_lightning(&mut buffer, pts[tip].0, pts[tip].1, end_x, end_y, anim.time);
                }
            }

            // Draw skeleton
            let line_color = if hand.handedness == "Left" { 0xFF00FFFF } else { 0xFFFF00FF };
            for (i1, i2) in CONNECTIONS.iter() {
                draw_line(&mut buffer, pts[*i1].0, pts[*i1].1, pts[*i2].0, pts[*i2].1, line_color, 2);
            }

            // Draw landmarks
            for (i, (px, py)) in pts.iter().enumerate() {
                let color = match i {
                    0 => 0xFFFF0000,
                    1..=4 => 0xFFFF8800,
                    5..=8 => 0xFFFFFF00,
                    9..=12 => 0xFF00FF00,
                    13..=16 => 0xFF00FFFF,
                    17..=20 => 0xFFFF00FF,
                    _ => 0xFFFFFFFF,
                };
                draw_circle(&mut buffer, *px, *py, 5, color);
            }
        }

        // Draw gesture indicator
        let gesture_color = match anim.detected_gesture.as_str() {
            "fist" => 0xFFFF0000,
            "open_palm" => 0xFF00FF00,
            "point" => 0xFFFFFF00,
            "peace" => 0xFF00FFFF,
            "pinch" => 0xFFFF00FF,
            _ => 0xFF888888,
        };
        draw_text_simple(&mut buffer, 10, 10, &anim.detected_gesture, gesture_color);

        // FPS counter
        frame_count += 1;
        let elapsed = last_fps_time.elapsed().as_secs_f32();
        if elapsed >= 1.0 {
            current_fps = frame_count as f32 / elapsed;
            println!("📊 FPS: {:.1} | Hands: {} | Gesture: {}",
                     current_fps, hands.len(), anim.detected_gesture);
            frame_count = 0;
            last_fps_time = Instant::now();
        }

        if let Err(e) = window.update_with_buffer(&buffer, WIDTH, HEIGHT) {
            eprintln!("Window update error: {}", e);
            break;
        }
    }

    println!("👋 Goodbye!");
    Ok(())
}
