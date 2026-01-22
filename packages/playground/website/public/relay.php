<?php
/**
 * PHP Relay Server for peer-to-peer Playground sharing.
 *
 * This relay enables sharing a Playground instance with others through HTTP
 * long-polling. The host browser processes WordPress requests and sends
 * responses back through the relay to guest browsers.
 *
 * Endpoints:
 * - POST /relay/session - Create a new tunnel session
 * - GET /relay/{sessionId}/poll - Host long-polls for guest requests
 * - POST /relay/{sessionId}/response/{requestId} - Host sends response
 * - ANY /relay/{sessionId}/request/* - Guest requests (proxied to host)
 *
 * Sessions and requests are stored in files under the data directory.
 * This works in both development (PHP WASM) and production (real PHP server).
 */

// Configuration
define('SESSION_TIMEOUT', 30 * 60); // 30 minutes
define('POLL_TIMEOUT', 25); // 25 seconds
define('REQUEST_TIMEOUT', 30); // 30 seconds
define('DATA_DIR', __DIR__ . '/relay-data');

// Ensure data directory exists
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0777, true);
}
if (!is_dir(DATA_DIR . '/sessions')) {
    mkdir(DATA_DIR . '/sessions', 0777, true);
}
if (!is_dir(DATA_DIR . '/requests')) {
    mkdir(DATA_DIR . '/requests', 0777, true);
}
if (!is_dir(DATA_DIR . '/responses')) {
    mkdir(DATA_DIR . '/responses', 0777, true);
}

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Request-Id');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

// Parse the request path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH);

// Remove base path if present (for Vite dev server)
$path = preg_replace('#^/website-server#', '', $path);

// Route the request
if ($path === '/relay/session' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleCreateSession();
} elseif (preg_match('#^/relay/([^/]+)/poll$#', $path, $matches)) {
    handlePoll($matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/response/([^/]+)$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleResponse($matches[1], $matches[2]);
} elseif (preg_match('#^/relay/([^/]+)/request(/.*)?$#', $path, $matches)) {
    handleGuestRequest($matches[1], $matches[2] ?? '/');
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

/**
 * Generate a UUID v4.
 */
function generateUuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Get session data.
 */
function getSession(string $sessionId): ?array {
    $file = DATA_DIR . '/sessions/' . $sessionId . '.json';
    if (!file_exists($file)) {
        return null;
    }

    $session = json_decode(file_get_contents($file), true);
    if (!$session) {
        return null;
    }

    // Check if session expired
    if (time() - $session['lastActivity'] > SESSION_TIMEOUT) {
        unlink($file);
        return null;
    }

    return $session;
}

/**
 * Save session data.
 */
function saveSession(string $sessionId, array $session): void {
    $session['lastActivity'] = time();
    file_put_contents(
        DATA_DIR . '/sessions/' . $sessionId . '.json',
        json_encode($session)
    );
}

/**
 * Create a new sharing session.
 */
function handleCreateSession(): void {
    $sessionId = generateUuid();

    $session = [
        'sessionId' => $sessionId,
        'createdAt' => time(),
        'lastActivity' => time(),
        'hostConnected' => false,
    ];

    saveSession($sessionId, $session);

    // Build share URL
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $protocol = $_SERVER['HTTP_X_FORWARDED_PROTO'];
    }
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    // Determine base path
    $basePath = '/';
    if (strpos($_SERVER['REQUEST_URI'] ?? '', '/website-server') === 0) {
        $basePath = '/website-server/';
    }

    $shareUrl = "{$protocol}://{$host}{$basePath}?share={$sessionId}";

    header('Content-Type: application/json');
    echo json_encode([
        'sessionId' => $sessionId,
        'shareUrl' => $shareUrl,
    ]);
}

/**
 * Host polls for guest requests.
 */
function handlePoll(string $sessionId): void {
    $session = getSession($sessionId);

    if (!$session) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Session not found']);
        return;
    }

    // Mark host as connected
    $session['hostConnected'] = true;
    saveSession($sessionId, $session);

    // Look for pending requests
    $requestsDir = DATA_DIR . '/requests/' . $sessionId;
    if (!is_dir($requestsDir)) {
        mkdir($requestsDir, 0777, true);
    }

    $startTime = time();
    $pollTimeout = POLL_TIMEOUT;

    // Long-poll: check for requests periodically
    while (time() - $startTime < $pollTimeout) {
        // Look for undispatched requests
        $files = glob($requestsDir . '/*.json');
        foreach ($files as $file) {
            $request = json_decode(file_get_contents($file), true);
            if ($request && !($request['dispatched'] ?? false)) {
                // Mark as dispatched
                $request['dispatched'] = true;
                file_put_contents($file, json_encode($request));

                header('Content-Type: application/json');
                echo json_encode(['request' => $request['request']]);
                return;
            }
        }

        // Wait a bit before checking again
        usleep(100000); // 100ms
    }

    // Timeout - no request available
    header('Content-Type: application/json');
    echo json_encode(['timeout' => true]);
}

/**
 * Host sends response for a request.
 */
function handleResponse(string $sessionId, string $requestId): void {
    $session = getSession($sessionId);

    if (!$session) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Session not found']);
        return;
    }

    // Read the response body
    $body = file_get_contents('php://input');
    $response = json_decode($body, true);

    if (!$response) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid response body']);
        return;
    }

    // Save response
    $responsesDir = DATA_DIR . '/responses/' . $sessionId;
    if (!is_dir($responsesDir)) {
        mkdir($responsesDir, 0777, true);
    }

    file_put_contents(
        $responsesDir . '/' . $requestId . '.json',
        json_encode($response)
    );

    // Update session activity
    saveSession($sessionId, $session);

    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
}

/**
 * Guest makes a request through the relay.
 */
function handleGuestRequest(string $sessionId, string $requestPath): void {
    $session = getSession($sessionId);

    if (!$session) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Session not found']);
        return;
    }

    if (!$session['hostConnected']) {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Host not connected']);
        return;
    }

    $requestId = generateUuid();

    // Collect headers
    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, 'HTTP_') === 0) {
            $headerName = str_replace('_', '-', strtolower(substr($key, 5)));
            $headers[$headerName] = $value;
        }
    }
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
    }

    // Read request body
    $body = file_get_contents('php://input');

    // Create the tunnel request
    $tunnelRequest = [
        'requestId' => $requestId,
        'method' => $_SERVER['REQUEST_METHOD'],
        'path' => $requestPath,
        'headers' => $headers,
        'body' => $body ?: null,
    ];

    // Save the request for the host to pick up
    $requestsDir = DATA_DIR . '/requests/' . $sessionId;
    if (!is_dir($requestsDir)) {
        mkdir($requestsDir, 0777, true);
    }

    file_put_contents(
        $requestsDir . '/' . $requestId . '.json',
        json_encode([
            'request' => $tunnelRequest,
            'dispatched' => false,
            'createdAt' => time(),
        ])
    );

    // Wait for response
    $responsesDir = DATA_DIR . '/responses/' . $sessionId;
    $responseFile = $responsesDir . '/' . $requestId . '.json';

    $startTime = time();
    $timeout = REQUEST_TIMEOUT;

    while (time() - $startTime < $timeout) {
        if (file_exists($responseFile)) {
            $response = json_decode(file_get_contents($responseFile), true);

            // Clean up
            @unlink($responseFile);
            @unlink($requestsDir . '/' . $requestId . '.json');

            if ($response) {
                // Send the response
                http_response_code($response['status']);

                foreach ($response['headers'] as $name => $value) {
                    // Skip certain headers
                    $lowerName = strtolower($name);
                    if (in_array($lowerName, ['transfer-encoding', 'connection', 'keep-alive'])) {
                        continue;
                    }
                    header("{$name}: {$value}");
                }

                // Decode base64 body
                if (!empty($response['body'])) {
                    echo base64_decode($response['body']);
                }
                return;
            }
        }

        usleep(50000); // 50ms
    }

    // Timeout - clean up and return error
    @unlink($requestsDir . '/' . $requestId . '.json');

    http_response_code(504);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Gateway timeout']);
}

/**
 * Clean up old sessions and requests (call periodically).
 */
function cleanup(): void {
    $now = time();

    // Clean up old sessions
    $sessionFiles = glob(DATA_DIR . '/sessions/*.json');
    foreach ($sessionFiles as $file) {
        $session = json_decode(file_get_contents($file), true);
        if ($session && $now - $session['lastActivity'] > SESSION_TIMEOUT) {
            $sessionId = $session['sessionId'];
            unlink($file);

            // Clean up session's requests and responses
            $requestsDir = DATA_DIR . '/requests/' . $sessionId;
            if (is_dir($requestsDir)) {
                array_map('unlink', glob($requestsDir . '/*.json'));
                rmdir($requestsDir);
            }

            $responsesDir = DATA_DIR . '/responses/' . $sessionId;
            if (is_dir($responsesDir)) {
                array_map('unlink', glob($responsesDir . '/*.json'));
                rmdir($responsesDir);
            }
        }
    }

    // Clean up orphaned request files (older than REQUEST_TIMEOUT * 2)
    $requestDirs = glob(DATA_DIR . '/requests/*', GLOB_ONLYDIR);
    foreach ($requestDirs as $dir) {
        $files = glob($dir . '/*.json');
        foreach ($files as $file) {
            if ($now - filemtime($file) > REQUEST_TIMEOUT * 2) {
                unlink($file);
            }
        }
    }
}

// Run cleanup occasionally (1% chance per request)
if (rand(1, 100) === 1) {
    cleanup();
}
