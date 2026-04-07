<?php
/**
 * PHP Relay Server for peer-to-peer Playground sharing.
 *
 * This relay enables sharing a Playground instance with others through HTTP
 * long-polling. The host browser processes WordPress requests and sends
 * responses back through the relay to guest browsers.
 *
 * Endpoints:
 * - POST /relay/session                       Create a new tunnel session
 * - GET  /relay/{sessionId}/poll              Host long-polls for guest requests
 * - POST /relay/{sessionId}/response/{reqId}  Host sends response
 * - GET  /relay/{sessionId}/status[?gid=...]  Guest health-check + heartbeat
 * - POST /relay/{sessionId}/close             Host explicitly tears down session
 * - ANY  /relay/{sessionId}/request/*         Guest requests (proxied to host)
 *
 * Sessions and pending requests are stored under DATA_DIR. The session JSON
 * is read and written under flock() so concurrent polls cannot dispatch the
 * same request twice. The data dir defaults to a per-system temp folder so
 * the relay does not write under the web root.
 *
 * Configuration env vars:
 * - PLAYGROUND_RELAY_DATA_DIR        Directory for session/request files.
 * - PLAYGROUND_RELAY_PUBLIC_BASE_URL Public-facing base URL for share links,
 *                                    e.g. http://localhost:5400/website-server/
 *                                    Falls back to deriving from request headers.
 */

// Configuration
define('SESSION_TIMEOUT_MS', 30 * 60 * 1000);     // 30 minutes
define('POLL_TIMEOUT_SEC', 25);                   // host long-poll
define('REQUEST_TIMEOUT_SEC', 30);                // guest request long-wait
/**
 * How long without a host poll before we consider the host "dead". A
 * healthy host re-polls immediately after each timeout (25s), so ~40s
 * gives one poll's worth of slack for network hiccups before we flip
 * hostConnected to false and fail pending guest requests fast.
 */
define('HOST_DEAD_AFTER_MS', 40 * 1000);
/**
 * How long without a guest heartbeat before we drop them from the
 * collaborator list. Guests heartbeat every ~3s via the /status
 * endpoint, so 10s gives roughly three missed beats before we forget
 * them — fast enough to feel "live", lax enough to ride out a hiccup.
 */
define('GUEST_DEAD_AFTER_MS', 10 * 1000);
// Data dir resolution, in order:
//   1. PLAYGROUND_RELAY_DATA_DIR from getenv() — set when running
//      under php -S or PHP-FPM with the env var exported.
//   2. The same key from $_SERVER — set when running inside
//      PHP-WASM, where php.run({env}) populates $_SERVER.
//   3. A per-system temp directory so the relay never writes under
//      the web root.
define(
    'DATA_DIR',
    getenv('PLAYGROUND_RELAY_DATA_DIR')
        ?: ($_SERVER['PLAYGROUND_RELAY_DATA_DIR'] ?? '')
        ?: sys_get_temp_dir() . '/playground-relay'
);

// Ensure data directory exists. Use mkdir-then-recheck so two
// concurrent requests racing to create the same dir don't blow up.
ensureDir(DATA_DIR);
ensureDir(DATA_DIR . '/sessions');
ensureDir(DATA_DIR . '/requests');
ensureDir(DATA_DIR . '/responses');

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
} elseif (preg_match('#^/relay/([^/]+)/status$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    handleStatus($matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/close$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleClose($matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/response/([^/]+)$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleResponse($matches[1], $matches[2]);
} elseif (preg_match('#^/relay/([^/]+)/request(/.*)?$#', $path, $matches)) {
    handleGuestRequest($matches[1], $matches[2] ?? '/');
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// Run cleanup occasionally (1% chance per request)
if (rand(1, 100) === 1) {
    cleanup();
}

/**
 * Create a directory if it doesn't already exist. Safe to call from
 * multiple processes at once: mkdir() is the only TOCTOU-free check —
 * we ignore its failure and only error out if the directory still
 * isn't there afterwards.
 */
function ensureDir(string $dir): void {
    if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
        throw new RuntimeException("Failed to create directory: $dir");
    }
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
 * Current time in milliseconds. Used everywhere instead of time()
 * because the wire protocol (lastPollAgoMs, lastSeenMs, …) and the
 * client constants are all in ms.
 */
function nowMs(): int {
    return (int) (microtime(true) * 1000);
}

/**
 * Open a session file under an exclusive lock, hand the parsed
 * session array to the callback, then write the (possibly mutated)
 * session back. Returns whatever the callback returned, or null when
 * the session does not exist or has expired.
 *
 * The callback receives the session by reference and may mutate it
 * freely. lastActivity is bumped automatically on write so the
 * caller never has to remember.
 *
 * This is the only correct way to read or modify a session — direct
 * file_get_contents() races with the host poll and the cleanup task.
 */
function withSession(string $sessionId, Closure $cb) {
    $file = DATA_DIR . '/sessions/' . $sessionId . '.json';
    if (!file_exists($file)) {
        return null;
    }
    $fh = @fopen($file, 'r+');
    if (!$fh) {
        return null;
    }
    // Best-effort lock. On real PHP this serialises concurrent
    // access; on PHP-WASM (single-threaded) flock is a no-op which
    // is fine because there is no concurrency to protect against.
    @flock($fh, LOCK_EX);
    $contents = stream_get_contents($fh);
    $session = $contents ? json_decode($contents, true) : null;

    if (!$session) {
        @flock($fh, LOCK_UN);
        fclose($fh);
        @unlink($file);
        return null;
    }

    // Check expiry while we hold the lock so a request that
    // arrives during cleanup races correctly.
    if (nowMs() - ($session['lastActivity'] ?? 0) > SESSION_TIMEOUT_MS) {
        @flock($fh, LOCK_UN);
        fclose($fh);
        @unlink($file);
        return null;
    }

    $result = $cb($session);

    $session['lastActivity'] = nowMs();
    rewind($fh);
    ftruncate($fh, 0);
    fwrite($fh, json_encode($session));
    fflush($fh);
    @flock($fh, LOCK_UN);
    fclose($fh);

    return $result;
}

/**
 * Drop any guests that have stopped heartbeating. Returns the
 * surviving guests as a serializable list, sorted by ordinal so the
 * order is stable across calls.
 */
function pruneGuests(array &$session, int $now): array {
    $survivors = [];
    foreach (($session['guests'] ?? []) as $gid => $guest) {
        if ($now - ($guest['lastSeenAt'] ?? 0) > GUEST_DEAD_AFTER_MS) {
            continue;
        }
        $survivors[$gid] = $guest;
    }
    $session['guests'] = $survivors;

    $list = array_values($survivors);
    usort($list, function ($a, $b) {
        return ($a['ordinal'] ?? 0) - ($b['ordinal'] ?? 0);
    });
    return array_map(function ($g) use ($now) {
        return [
            'id' => $g['id'],
            'label' => $g['label'],
            'lastSeenMs' => $now - ($g['lastSeenAt'] ?? $now),
        ];
    }, $list);
}

/**
 * Register a heartbeat for a guest, creating its record on first
 * sight. The ordinal — and therefore the "Guest N" label — sticks
 * for the lifetime of the session even if the guest reconnects.
 */
function recordGuestHeartbeat(array &$session, string $guestId, int $now): void {
    if (!isset($session['guests'])) {
        $session['guests'] = [];
    }
    if (isset($session['guests'][$guestId])) {
        $session['guests'][$guestId]['lastSeenAt'] = $now;
        return;
    }
    $ordinal = ($session['nextGuestOrdinal'] ?? 1);
    $session['nextGuestOrdinal'] = $ordinal + 1;
    $session['guests'][$guestId] = [
        'id' => $guestId,
        'ordinal' => $ordinal,
        'label' => "Guest {$ordinal}",
        'firstSeenAt' => $now,
        'lastSeenAt' => $now,
    ];
}

/**
 * Mark a session's host as disconnected. Safe to call multiple
 * times. We can't reject in-flight guest requests like the TS
 * middleware does (PHP has no shared memory of pending waiters), so
 * we delete the request files instead — the wait loops in
 * handleGuestRequest also re-check hostConnected periodically and
 * bail out fast.
 */
function markHostDisconnected(array &$session, string $reason): void {
    $session['hostConnected'] = false;
}

/**
 * Delete every queued request file for a session. Used by /close
 * (and would-be cleanup paths) so guest wait loops time out fast
 * instead of hanging until REQUEST_TIMEOUT_SEC.
 */
function rejectPendingRequests(string $sessionId): void {
    $dir = DATA_DIR . '/requests/' . $sessionId;
    if (!is_dir($dir)) {
        return;
    }
    foreach (glob($dir . '/*.json') ?: [] as $file) {
        @unlink($file);
    }
}

/**
 * Build the public-facing share URL. Honors
 * PLAYGROUND_RELAY_PUBLIC_BASE_URL when set so a relay running
 * behind a proxy on a different host/port can still hand out a
 * share link that points at the actual website.
 */
function buildShareUrl(string $sessionId): string {
    $publicBase = getenv('PLAYGROUND_RELAY_PUBLIC_BASE_URL') ?: '';
    if ($publicBase !== '') {
        return rtrim($publicBase, '/') . '/?share=' . $sessionId;
    }

    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'
        ? 'https'
        : 'http';
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $protocol = $_SERVER['HTTP_X_FORWARDED_PROTO'];
    }
    $host = $_SERVER['HTTP_X_FORWARDED_HOST']
        ?? $_SERVER['HTTP_HOST']
        ?? 'localhost';

    $basePath = '/';
    if (strpos($_SERVER['REQUEST_URI'] ?? '', '/website-server') === 0) {
        $basePath = '/website-server/';
    }

    return "{$protocol}://{$host}{$basePath}?share={$sessionId}";
}

/**
 * Create a new sharing session.
 */
function handleCreateSession(): void {
    $sessionId = generateUuid();
    $now = nowMs();

    $session = [
        'sessionId' => $sessionId,
        'createdAt' => $now,
        'lastActivity' => $now,
        'lastPollAt' => 0,
        'hostConnected' => false,
        'guests' => (object) [], // serialised as {} not []
        'nextGuestOrdinal' => 1,
    ];

    $file = DATA_DIR . '/sessions/' . $sessionId . '.json';
    file_put_contents($file, json_encode($session));

    header('Content-Type: application/json');
    echo json_encode([
        'sessionId' => $sessionId,
        'shareUrl' => buildShareUrl($sessionId),
    ]);
}

/**
 * Host polls for guest requests.
 */
function handlePoll(string $sessionId): void {
    // Mark host as connected and record this poll's timestamp under
    // a session lock so concurrent /status requests see fresh data.
    $session = withSession($sessionId, function (array &$session) {
        $session['hostConnected'] = true;
        $session['lastPollAt'] = nowMs();
        pruneGuests($session, nowMs());
        return $session;
    });

    if (!$session) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Session not found']);
        return;
    }

    $requestsDir = DATA_DIR . '/requests/' . $sessionId;
    ensureDir($requestsDir);

    $startTime = time();

    // Long-poll: check for requests periodically. Each candidate
    // request file is opened under flock() so two pollers cannot
    // dispatch the same request twice (the original code did a
    // racy read-modify-write that could double-deliver).
    while (time() - $startTime < POLL_TIMEOUT_SEC) {
        $files = glob($requestsDir . '/*.json') ?: [];
        foreach ($files as $file) {
            $fh = @fopen($file, 'r+');
            if (!$fh) {
                continue;
            }
            // Non-blocking try-lock so a long-running response
            // upload from the host doesn't block the poll loop.
            if (!@flock($fh, LOCK_EX | LOCK_NB)) {
                fclose($fh);
                continue;
            }
            $contents = stream_get_contents($fh);
            $request = $contents ? json_decode($contents, true) : null;
            if ($request && empty($request['dispatched'])) {
                $request['dispatched'] = true;
                rewind($fh);
                ftruncate($fh, 0);
                fwrite($fh, json_encode($request));
                fflush($fh);
                @flock($fh, LOCK_UN);
                fclose($fh);

                header('Content-Type: application/json');
                echo json_encode(['request' => $request['request']]);
                return;
            }
            @flock($fh, LOCK_UN);
            fclose($fh);
        }

        usleep(100000); // 100ms
    }

    header('Content-Type: application/json');
    echo json_encode(['timeout' => true]);
}

/**
 * Guest polls session health. Lets the guest UI flip to a "host
 * disconnected" state without waiting for a tunneled request to
 * time out. Doubles as the guest heartbeat: when the request
 * includes a `?gid=<uuid>` query param we record/refresh that guest
 * in the session's collaborator map. The host periodically polls
 * the same endpoint without a gid to see who is currently
 * connected.
 */
function handleStatus(string $sessionId): void {
    $now = nowMs();

    $queryString = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY) ?? '';
    parse_str($queryString, $queryParams);
    $guestId = isset($queryParams['gid']) ? (string) $queryParams['gid'] : null;

    $result = withSession($sessionId, function (array &$session) use ($guestId, $now) {
        // Proactively age-out a silent host so the very first
        // status request after a host disappears already reports
        // disconnected.
        if (
            !empty($session['hostConnected']) &&
            ($session['lastPollAt'] ?? 0) > 0 &&
            $now - $session['lastPollAt'] > HOST_DEAD_AFTER_MS
        ) {
            markHostDisconnected($session, 'status check: no poll');
        }

        if ($guestId) {
            recordGuestHeartbeat($session, $guestId, $now);
        }

        $guests = pruneGuests($session, $now);
        $lastPollAt = (int) ($session['lastPollAt'] ?? 0);
        $lastPollAgoMs = $lastPollAt > 0 ? $now - $lastPollAt : -1;

        return [
            'sessionId' => $session['sessionId'],
            'hostConnected' => (bool) ($session['hostConnected'] ?? false),
            'hostAlive' =>
                !empty($session['hostConnected']) &&
                $lastPollAt > 0 &&
                $lastPollAgoMs < HOST_DEAD_AFTER_MS,
            'lastPollAgoMs' => $lastPollAgoMs,
            'guests' => $guests,
        ];
    });

    if (!$result) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Session not found']);
        return;
    }

    header('Content-Type: application/json');
    echo json_encode($result);
}

/**
 * Host explicitly closes the session. The browser fires this via
 * navigator.sendBeacon on pagehide so guests see the disconnect
 * immediately instead of after the dead-host timer.
 */
function handleClose(string $sessionId): void {
    withSession($sessionId, function (array &$session) {
        markHostDisconnected($session, 'host requested close');
    });
    // Drop in-flight guest requests so their long-wait loops bail
    // out instead of hanging for the full REQUEST_TIMEOUT_SEC.
    rejectPendingRequests($sessionId);

    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
}

/**
 * Host sends response for a request.
 */
function handleResponse(string $sessionId, string $requestId): void {
    $session = withSession($sessionId, function (array &$session) {
        return $session;
    });

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
    ensureDir($responsesDir);

    file_put_contents(
        $responsesDir . '/' . $requestId . '.json',
        json_encode($response)
    );

    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
}

/**
 * Guest makes a request through the relay.
 */
function handleGuestRequest(string $sessionId, string $requestPath): void {
    $session = withSession($sessionId, function (array &$session) {
        // Age-out check here too so a guest request that arrives
        // first after the host disappears doesn't pin a worker for
        // 30s waiting on a response that will never come.
        $now = nowMs();
        if (
            !empty($session['hostConnected']) &&
            ($session['lastPollAt'] ?? 0) > 0 &&
            $now - $session['lastPollAt'] > HOST_DEAD_AFTER_MS
        ) {
            markHostDisconnected($session, 'guest request: no poll');
        }
        return $session;
    });

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
        'body' => $body !== '' ? $body : null,
    ];

    // Save the request for the host to pick up
    $requestsDir = DATA_DIR . '/requests/' . $sessionId;
    ensureDir($requestsDir);

    $requestFile = $requestsDir . '/' . $requestId . '.json';
    file_put_contents(
        $requestFile,
        json_encode([
            'request' => $tunnelRequest,
            'dispatched' => false,
            'createdAt' => nowMs(),
        ])
    );

    // Wait for response. Re-check session health every ~1s so we
    // can fail fast if the host disconnects mid-wait instead of
    // sitting around for the full timeout.
    $responsesDir = DATA_DIR . '/responses/' . $sessionId;
    $responseFile = $responsesDir . '/' . $requestId . '.json';

    $startTime = time();
    $lastHealthCheck = 0;

    while (time() - $startTime < REQUEST_TIMEOUT_SEC) {
        if (file_exists($responseFile)) {
            $response = json_decode(file_get_contents($responseFile), true);

            // Clean up
            @unlink($responseFile);
            @unlink($requestFile);

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

        // If close() deleted our request file, the host won't see
        // it any more — bail out instead of waiting for the timer.
        if (!file_exists($requestFile)) {
            http_response_code(503);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Host disconnected']);
            return;
        }

        // Periodic re-check: did the host stop polling while we
        // were waiting? Reading the session is cheap and lets us
        // bail out within ~1s of a disconnect.
        $nowSec = time();
        if ($nowSec - $lastHealthCheck >= 1) {
            $lastHealthCheck = $nowSec;
            $check = withSession($sessionId, function (array &$session) {
                $now = nowMs();
                if (
                    !empty($session['hostConnected']) &&
                    ($session['lastPollAt'] ?? 0) > 0 &&
                    $now - $session['lastPollAt'] > HOST_DEAD_AFTER_MS
                ) {
                    markHostDisconnected($session, 'guest wait: no poll');
                }
                return $session;
            });
            if (!$check || !$check['hostConnected']) {
                @unlink($requestFile);
                http_response_code(503);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Host disconnected']);
                return;
            }
        }

        usleep(50000); // 50ms
    }

    // Timeout - clean up and return error
    @unlink($requestFile);

    http_response_code(504);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Gateway timeout']);
}

/**
 * Clean up old sessions and requests (call periodically).
 */
function cleanup(): void {
    $now = nowMs();

    // Clean up old sessions
    $sessionFiles = glob(DATA_DIR . '/sessions/*.json') ?: [];
    foreach ($sessionFiles as $file) {
        $session = json_decode(@file_get_contents($file) ?: '', true);
        if ($session && $now - ($session['lastActivity'] ?? 0) > SESSION_TIMEOUT_MS) {
            $sessionId = $session['sessionId'];
            @unlink($file);

            // Clean up session's requests and responses
            $requestsDir = DATA_DIR . '/requests/' . $sessionId;
            if (is_dir($requestsDir)) {
                array_map('unlink', glob($requestsDir . '/*.json') ?: []);
                @rmdir($requestsDir);
            }

            $responsesDir = DATA_DIR . '/responses/' . $sessionId;
            if (is_dir($responsesDir)) {
                array_map('unlink', glob($responsesDir . '/*.json') ?: []);
                @rmdir($responsesDir);
            }
        }
    }

    // Clean up orphaned request files (older than REQUEST_TIMEOUT_SEC * 2)
    $requestDirs = glob(DATA_DIR . '/requests/*', GLOB_ONLYDIR) ?: [];
    foreach ($requestDirs as $dir) {
        $files = glob($dir . '/*.json') ?: [];
        foreach ($files as $file) {
            if ($now / 1000 - filemtime($file) > REQUEST_TIMEOUT_SEC * 2) {
                @unlink($file);
            }
        }
    }
}
