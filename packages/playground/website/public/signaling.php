<?php
/**
 * WebRTC signaling endpoint for WordPress Playground P2P sync.
 *
 * Stores and retrieves SDP offers/answers using MySQL so that two
 * browser tabs can establish a direct WebRTC connection.
 *
 * API (all via query params on signaling.php):
 *
 *   POST ?action=create                → {"room_code": "A7K3M2"}
 *   POST ?action=offer&room=X   body: {"sdp": "..."}  → {"ok": true}
 *   POST ?action=answer&room=X  body: {"sdp": "..."}  → {"ok": true}
 *   GET  ?action=poll&room=X&role=offerer|answerer     → {"answer":"..."} or {"offer":"..."}
 */

// Disable error display in production.
error_reporting(0);
ini_set('display_errors', '0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://playground.wordpress.net');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$MAX_SDP_SIZE = 64 * 1024; // 64 KB

/**
 * Send a JSON response and terminate.
 */
function respond($data, $status = 200) {
    http_response_code($status);
    die(json_encode($data));
}

/**
 * Get a PDO connection using environment variables.
 */
function get_db() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $host = getenv('DB_HOST') ?: 'localhost';
    $user = getenv('DB_USER');
    $pass = getenv('DB_PASS');
    $name = getenv('DB_NAME');

    if (!$user || !$name) {
        respond(['error' => 'Database not configured'], 500);
    }

    $dsn = "mysql:host=$host;dbname=$name;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    return $pdo;
}

/**
 * Ensure the signaling table exists.
 */
function ensure_table() {
    $db = get_db();
    $db->exec("
        CREATE TABLE IF NOT EXISTS playground_signaling_rooms (
            room_code VARCHAR(12) PRIMARY KEY,
            offer TEXT DEFAULT NULL,
            answer TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
}

/**
 * Generate a 6-character alphanumeric room code (uppercase).
 */
function generate_room_code() {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $code = '';
    for ($i = 0; $i < 6; $i++) {
        $code .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $code;
}

/**
 * Delete rooms older than 10 minutes.
 */
function cleanup_expired_rooms() {
    $db = get_db();
    $db->exec(
        "DELETE FROM playground_signaling_rooms
         WHERE created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
    );
}

// --- Main logic ---

ensure_table();

$action = $_GET['action'] ?? '';

if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    cleanup_expired_rooms();

    // Try a few times in case of code collision.
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $code = generate_room_code();
        $stmt = get_db()->prepare(
            "INSERT IGNORE INTO playground_signaling_rooms (room_code)
             VALUES (:code)"
        );
        $stmt->execute([':code' => $code]);
        if ($stmt->rowCount() > 0) {
            respond(['room_code' => $code]);
        }
    }
    respond(['error' => 'Failed to create room'], 500);
}

// All other actions require a room parameter.
$room = $_GET['room'] ?? '';
if (!$room) {
    respond(['error' => 'Missing room parameter'], 400);
}

// Validate room exists.
$stmt = get_db()->prepare(
    "SELECT room_code FROM playground_signaling_rooms
     WHERE room_code = :code"
);
$stmt->execute([':code' => $room]);
if (!$stmt->fetch()) {
    respond(['error' => 'Room not found'], 404);
}

if ($action === 'offer' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    if (strlen($body) > $MAX_SDP_SIZE) {
        respond(['error' => 'SDP payload too large'], 400);
    }
    $data = json_decode($body, true);
    $sdp = $data['sdp'] ?? '';
    if (!is_string($sdp) || $sdp === '') {
        respond(['error' => 'Missing sdp'], 400);
    }

    $stmt = get_db()->prepare(
        "UPDATE playground_signaling_rooms
         SET offer = :sdp WHERE room_code = :code"
    );
    $stmt->execute([':sdp' => $sdp, ':code' => $room]);
    respond(['ok' => true]);
}

if ($action === 'answer' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    if (strlen($body) > $MAX_SDP_SIZE) {
        respond(['error' => 'SDP payload too large'], 400);
    }
    $data = json_decode($body, true);
    $sdp = $data['sdp'] ?? '';
    if (!is_string($sdp) || $sdp === '') {
        respond(['error' => 'Missing sdp'], 400);
    }

    $stmt = get_db()->prepare(
        "UPDATE playground_signaling_rooms
         SET answer = :sdp WHERE room_code = :code"
    );
    $stmt->execute([':sdp' => $sdp, ':code' => $room]);
    respond(['ok' => true]);
}

if ($action === 'poll' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $role = $_GET['role'] ?? '';
    $stmt = get_db()->prepare(
        "SELECT offer, answer FROM playground_signaling_rooms
         WHERE room_code = :code"
    );
    $stmt->execute([':code' => $room]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($role === 'offerer') {
        respond(['answer' => $row['answer']]);
    } elseif ($role === 'answerer') {
        respond(['offer' => $row['offer']]);
    } else {
        respond(['error' => 'Invalid role'], 400);
    }
}

respond(['error' => 'Invalid action'], 400);
