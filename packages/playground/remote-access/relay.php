<?php
/**
 * Minimal WordPress Playground Remote Access relay.
 *
 * This file is only a rendezvous/signaling service for the direct WebRTC
 * remote access tunnel. It stores session metadata plus small WebRTC messages
 * (offer, answer, ICE candidates, heartbeat, retry request). In WebRTC, ICE
 * means Interactive Connectivity Establishment: the browser process for
 * discovering candidate network paths between peers. WordPress HTTP requests
 * and responses are not proxied through this PHP file.
 *
 * The six-digit code is a rendezvous hint, not an authorization grant. The
 * remote device still needs to open a direct WebRTC data channel and the host
 * device must approve the two-digit verification code before any WordPress
 * requests or backup data can flow.
 */

define('SESSION_TIMEOUT_MS', 5 * 60 * 1000);
define('HOST_DEAD_AFTER_MS', 40 * 1000);
define('GUEST_DEAD_AFTER_MS', 10 * 1000);
define('SIGNAL_RETENTION_MS', 15 * 60 * 1000);
define('SIGNAL_POLL_TIMEOUT_SEC', 25);
define('MAX_SIGNAL_BODY_BYTES', 8 * 1024);
define('MAX_SIGNAL_ID_BYTES', 64);
define('MAX_SIGNAL_SDP_BYTES', 4096);
define('MAX_SIGNAL_ICE_CANDIDATE_BYTES', 1024);
define('SESSIONS_TABLE', 'playground_remote_access_sessions');
define('SIGNALS_TABLE', 'playground_remote_access_signals');
define('GUESTS_TABLE', 'playground_remote_access_guests');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/website-server#', '', $path);
$relayAction = getQueryStringValue('action');

try {
    if ($relayAction !== null) {
        if (!handleDirectRelayRequest($relayAction)) {
            jsonResponse(['error' => 'Not found'], 404);
        }
    } elseif ($path === '/relay/session' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        handleCreateSession();
    } elseif (preg_match('#^/relay/code/([0-9-]+)$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
        handleResolveAccessCode($matches[1]);
    } elseif (preg_match('#^/relay/([^/]+)/status$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
        handleStatus($matches[1]);
    } elseif (preg_match('#^/relay/([^/]+)/signal$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        handlePostSignal($matches[1]);
    } elseif (preg_match('#^/relay/([^/]+)/signal$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
        handlePollSignal($matches[1]);
    } elseif (preg_match('#^/relay/([^/]+)/close$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        handleClose($matches[1]);
    } else {
        jsonResponse(['error' => 'Not found'], 404);
    }

    if (random_int(1, 100) === 1) {
        cleanupSessions();
    }
} catch (Throwable $e) {
    error_log('Remote access relay error: ' . $e->getMessage());
    jsonResponse(['error' => 'Remote access relay error'], 500);
}

function handleDirectRelayRequest(string $action): bool {
    if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        handleCreateSession();
        return true;
    }

    if ($action === 'code' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $accessCode = getQueryStringValue('accessCode');
        if ($accessCode === null) {
            jsonResponse(['error' => 'Missing accessCode'], 400);
            return true;
        }
        handleResolveAccessCode($accessCode);
        return true;
    }

    if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $sessionId = getQueryStringValue('sessionId');
        if ($sessionId === null) {
            jsonResponse(['error' => 'Missing sessionId'], 400);
            return true;
        }
        handleStatus($sessionId);
        return true;
    }

    if ($action === 'signal') {
        $sessionId = getQueryStringValue('sessionId');
        if ($sessionId === null) {
            jsonResponse(['error' => 'Missing sessionId'], 400);
            return true;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            handlePostSignal($sessionId);
            return true;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            handlePollSignal($sessionId);
            return true;
        }
    }

    if ($action === 'close' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $sessionId = getQueryStringValue('sessionId');
        if ($sessionId === null) {
            jsonResponse(['error' => 'Missing sessionId'], 400);
            return true;
        }
        handleClose($sessionId);
        return true;
    }

    return false;
}

function getQueryStringValue(string $name): ?string {
    if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
        return null;
    }
    return $_GET[$name];
}

function handleCreateSession(): void {
    for ($i = 0; $i < 10; $i++) {
        $sessionId = generateUuid();
        $accessCode = generateAccessCode();
        $now = nowMs();

        if (!insertSession($sessionId, $accessCode, $now)) {
            continue;
        }

        jsonResponse([
            'sessionId' => $sessionId,
            'shareUrl' => buildShareUrl($sessionId),
            'accessCode' => $accessCode,
        ]);
        return;
    }

    jsonResponse(['error' => 'Could not allocate access code'], 503);
}

function handleResolveAccessCode(string $rawAccessCode): void {
    // Resolving the code only reveals the relay session id. The phone-side
    // verification step is the authorization boundary for the remote access tunnel.
    $accessCode = normalizeAccessCode($rawAccessCode);
    if ($accessCode === '') {
        jsonResponse(['error' => 'Invalid access code'], 400);
        return;
    }

    $sessionId = resolveAccessCode($accessCode);
    if (!$sessionId) {
        jsonResponse(['error' => 'Access code not found'], 404);
        return;
    }

    jsonResponse([
        'sessionId' => $sessionId,
        'shareUrl' => buildShareUrl($sessionId),
        'accessCode' => $accessCode,
    ]);
}

function handleStatus(string $sessionId): void {
    $queryString = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY) ?? '';
    parse_str($queryString, $queryParams);
    $guestId = isset($queryParams['gid']) ? (string) $queryParams['gid'] : null;
    $now = nowMs();

    $session = getSession($sessionId);
    if (!$session) {
        jsonResponse(['error' => 'Session not found'], 404);
        return;
    }
    refreshHostState($session, $now);
    if ($guestId) {
        recordGuestHeartbeat($sessionId, $guestId, $now);
    }
    touchSession($sessionId, $now);
    jsonResponse(sessionStatus($session, $now));
}

function handlePostSignal(string $sessionId): void {
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false) {
        jsonResponse(['error' => 'Could not read request body'], 400);
        return;
    }
    if (strlen($rawBody) > MAX_SIGNAL_BODY_BYTES) {
        jsonResponse(['error' => 'Signal body too large'], 413);
        return;
    }

    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        jsonResponse(['error' => 'Invalid signal body'], 400);
        return;
    }

    $from = (string) ($payload['from'] ?? '');
    $to = (string) ($payload['to'] ?? '');
    $type = (string) ($payload['type'] ?? '');
    if (!isValidSignal($from, $to, $type)) {
        jsonResponse(['error' => 'Invalid signal'], 400);
        return;
    }

    $session = getSession($sessionId);
    if (!$session) {
        jsonResponse(['error' => 'Session not found'], 404);
        return;
    }

    $now = nowMs();
    if ($from === 'host') {
        markHostSeen($sessionId, $now);
    } else {
        touchSession($sessionId, $now);
    }

    if ($type === 'heartbeat') {
        jsonResponse(['ok' => true, 'seq' => latestSignalSeq($sessionId)]);
        return;
    }

    $data = validateSignalData($type, $payload['data'] ?? null);
    if ($data === null) {
        jsonResponse(['error' => 'Invalid signal data'], 400);
        return;
    }

    jsonResponse([
        'ok' => true,
        'seq' => insertSignal(
            $sessionId,
            $from,
            $to,
            $type,
            $data,
            $now
        ),
    ]);
}

function handlePollSignal(string $sessionId): void {
    $queryString = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY) ?? '';
    parse_str($queryString, $queryParams);
    $to = (string) ($queryParams['to'] ?? '');
    $since = (int) ($queryParams['since'] ?? 0);
    $guestId = isset($queryParams['gid']) ? (string) $queryParams['gid'] : null;
    if (!in_array($to, ['host', 'guest'], true)) {
        jsonResponse(['error' => 'Invalid signal recipient'], 400);
        return;
    }

    $now = nowMs();
    $session = getSession($sessionId);
    if (!$session) {
        jsonResponse(['error' => 'Session not found'], 404);
        return;
    }
    refreshHostState($session, $now);
    if ($to === 'guest' && $guestId) {
        recordGuestHeartbeat($sessionId, $guestId, $now);
    } else {
        touchSession($sessionId, $now);
    }

    $startTime = time();
    while (time() - $startTime < SIGNAL_POLL_TIMEOUT_SEC) {
        $now = nowMs();
        $session = getSession($sessionId);
        if (!$session) {
            jsonResponse(['error' => 'Session not found'], 404);
            return;
        }
        $result = pollSignals($sessionId, $to, $since);
        $result['hostAlive'] = isHostAlive($session, $now);
        if ($result['messages']) {
            jsonResponse($result);
            return;
        }
        usleep(100000);
    }

    $session = getSession($sessionId);
    if ($session) {
        refreshHostState($session, nowMs());
    }
    jsonResponse([
        'messages' => [],
        'cursor' => $since,
        'hostAlive' => $session ? isHostAlive($session, nowMs()) : false,
    ]);
}

function handleClose(string $sessionId): void {
    setHostConnected($sessionId, false);
    jsonResponse(['ok' => true]);
}

function validateSignalData(string $type, $data): ?array {
    if ($type === 'retry-request') {
        return validateRetryRequestSignalData($data);
    }
    if ($type === 'offer' || $type === 'answer') {
        return validateSessionDescriptionSignalData($type, $data);
    }
    if ($type === 'candidate') {
        return validateIceCandidateSignalData($data);
    }
    return null;
}

function validateRetryRequestSignalData($data): ?array {
    if (!is_array($data)) {
        return null;
    }
    $guestId = $data['guestId'] ?? null;
    if (!isBoundedString($guestId, 1, MAX_SIGNAL_ID_BYTES)) {
        return null;
    }
    return ['guestId' => $guestId];
}

function validateSessionDescriptionSignalData(string $type, $data): ?array {
    if (!is_array($data)) {
        return null;
    }
    $attemptId = $data['attemptId'] ?? null;
    $payload = $data['payload'] ?? null;
    if (
        !isBoundedString($attemptId, 1, MAX_SIGNAL_ID_BYTES) ||
        !is_array($payload)
    ) {
        return null;
    }
    $descriptionType = $payload['type'] ?? null;
    $sdp = $payload['sdp'] ?? null;
    if (
        $descriptionType !== $type ||
        !isBoundedString($sdp, 1, MAX_SIGNAL_SDP_BYTES)
    ) {
        return null;
    }
    return [
        'attemptId' => $attemptId,
        'payload' => [
            'type' => $descriptionType,
            'sdp' => $sdp,
        ],
    ];
}

function validateIceCandidateSignalData($data): ?array {
    if (!is_array($data)) {
        return null;
    }
    $attemptId = $data['attemptId'] ?? null;
    $payload = $data['payload'] ?? null;
    if (
        !isBoundedString($attemptId, 1, MAX_SIGNAL_ID_BYTES) ||
        !is_array($payload)
    ) {
        return null;
    }

    $candidate = $payload['candidate'] ?? null;
    $sdpMid = $payload['sdpMid'] ?? null;
    $sdpMLineIndex = $payload['sdpMLineIndex'] ?? null;
    $usernameFragment = $payload['usernameFragment'] ?? null;
    if (
        !isBoundedString($candidate, 0, MAX_SIGNAL_ICE_CANDIDATE_BYTES) ||
        !isNullableBoundedString($sdpMid, 0, MAX_SIGNAL_ID_BYTES) ||
        !isNullableInt($sdpMLineIndex) ||
        !isNullableBoundedString($usernameFragment, 0, MAX_SIGNAL_ID_BYTES)
    ) {
        return null;
    }

    $candidatePayload = [
        'candidate' => $candidate,
        'sdpMid' => $sdpMid,
        'sdpMLineIndex' => $sdpMLineIndex,
    ];
    if (array_key_exists('usernameFragment', $payload)) {
        $candidatePayload['usernameFragment'] = $usernameFragment;
    }
    return [
        'attemptId' => $attemptId,
        'payload' => $candidatePayload,
    ];
}

function isNullableInt($value): bool {
    return $value === null || is_int($value);
}

function isNullableBoundedString($value, int $minBytes, int $maxBytes): bool {
    return $value === null || isBoundedString($value, $minBytes, $maxBytes);
}

function isBoundedString($value, int $minBytes, int $maxBytes): bool {
    if (!is_string($value)) {
        return false;
    }
    $length = strlen($value);
    return $length >= $minBytes && $length <= $maxBytes;
}

function insertSession(
    string $sessionId,
    string $accessCode,
    int $now
): bool {
    $stmt = db()->prepare(
        'INSERT INTO ' . SESSIONS_TABLE . '
            (
                session_id,
                access_code,
                created_at_ms,
                last_activity_ms,
                last_host_seen_at_ms,
                host_connected
            )
         VALUES (?, ?, ?, ?, 0, 0)'
    );
    try {
        $createdAt = (string) $now;
        $lastActivity = (string) $now;
        $stmt->bind_param(
            'ssss',
            $sessionId,
            $accessCode,
            $createdAt,
            $lastActivity
        );
        $stmt->execute();
        return true;
    } catch (mysqli_sql_exception $e) {
        if ((int) $e->getCode() === 1062) {
            return false;
        }
        throw $e;
    }
}

function getSession(string $sessionId): ?array {
    $stmt = db()->prepare(
        'SELECT
            session_id,
            access_code,
            created_at_ms,
            last_activity_ms,
            last_host_seen_at_ms,
            host_connected
         FROM ' . SESSIONS_TABLE . '
         WHERE session_id = ?
         LIMIT 1'
    );
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }
    if (isExpired($row, nowMs())) {
        deleteSession($sessionId);
        return null;
    }
    return $row;
}

function resolveAccessCode(string $accessCode): ?string {
    $deadline = nowMs() - SESSION_TIMEOUT_MS;
    $stmt = db()->prepare(
        'SELECT session_id FROM ' . SESSIONS_TABLE . '
         WHERE access_code = ? AND last_activity_ms >= ?
         LIMIT 1'
    );
    $deadlineMs = (string) $deadline;
    $stmt->bind_param('ss', $accessCode, $deadlineMs);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }
    return (string) $row['session_id'];
}

function deleteSession(string $sessionId): void {
    $stmt = db()->prepare('DELETE FROM ' . SIGNALS_TABLE . ' WHERE session_id = ?');
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();

    $stmt = db()->prepare('DELETE FROM ' . GUESTS_TABLE . ' WHERE session_id = ?');
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();

    $stmt = db()->prepare('DELETE FROM ' . SESSIONS_TABLE . ' WHERE session_id = ?');
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
}

function cleanupSessions(): void {
    cleanupOldSignals();

    $now = nowMs();
    $sessionDeadline = $now - SESSION_TIMEOUT_MS;
    $guestDeadline = $now - GUEST_DEAD_AFTER_MS;

    $stmt = db()->prepare(
        'DELETE FROM ' . GUESTS_TABLE . ' WHERE last_seen_at_ms < ?'
    );
    $guestDeadlineMs = (string) $guestDeadline;
    $stmt->bind_param('s', $guestDeadlineMs);
    $stmt->execute();

    db()->query(
        'DELETE FROM ' . SIGNALS_TABLE . '
         WHERE session_id IN (
             SELECT session_id FROM ' . SESSIONS_TABLE . '
             WHERE last_activity_ms < ' . (int) $sessionDeadline . '
         )'
    );
    db()->query(
        'DELETE FROM ' . GUESTS_TABLE . '
         WHERE session_id IN (
             SELECT session_id FROM ' . SESSIONS_TABLE . '
             WHERE last_activity_ms < ' . (int) $sessionDeadline . '
         )'
    );
    $stmt = db()->prepare(
        'DELETE FROM ' . SESSIONS_TABLE . ' WHERE last_activity_ms < ?'
    );
    $sessionDeadlineMs = (string) $sessionDeadline;
    $stmt->bind_param('s', $sessionDeadlineMs);
    $stmt->execute();
}

function cleanupOldSignals(): void {
    $deadline = nowMs() - SIGNAL_RETENTION_MS;
    $stmt = db()->prepare(
        'DELETE FROM ' . SIGNALS_TABLE . ' WHERE created_at_ms < ?'
    );
    $deadlineMs = (string) $deadline;
    $stmt->bind_param('s', $deadlineMs);
    $stmt->execute();
}

function touchSession(string $sessionId, int $now): void {
    $stmt = db()->prepare(
        'UPDATE ' . SESSIONS_TABLE . '
         SET last_activity_ms = ?
         WHERE session_id = ?'
    );
    $nowMs = (string) $now;
    $stmt->bind_param('ss', $nowMs, $sessionId);
    $stmt->execute();
}

function markHostSeen(string $sessionId, int $now): void {
    $stmt = db()->prepare(
        'UPDATE ' . SESSIONS_TABLE . '
         SET host_connected = 1,
             last_host_seen_at_ms = ?,
             last_activity_ms = ?
         WHERE session_id = ?'
    );
    $hostSeenAt = (string) $now;
    $lastActivity = (string) $now;
    $stmt->bind_param('sss', $hostSeenAt, $lastActivity, $sessionId);
    $stmt->execute();
}

function setHostConnected(string $sessionId, bool $isConnected): void {
    $value = $isConnected ? 1 : 0;
    $now = nowMs();
    $stmt = db()->prepare(
        'UPDATE ' . SESSIONS_TABLE . '
         SET host_connected = ?,
             last_activity_ms = ?
         WHERE session_id = ?'
    );
    $nowMs = (string) $now;
    $stmt->bind_param('iss', $value, $nowMs, $sessionId);
    $stmt->execute();
}

function insertSignal(
    string $sessionId,
    string $from,
    string $to,
    string $type,
    $data,
    int $now
): int {
    try {
        $encodedData = json_encode($data, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    } catch (JsonException $e) {
        jsonResponse(['error' => 'Invalid signal data'], 400);
        exit;
    }
    $stmt = db()->prepare(
        'INSERT INTO ' . SIGNALS_TABLE . '
            (
                session_id,
                from_peer,
                to_peer,
                signal_type,
                signal_data,
                created_at_ms
            )
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $createdAt = (string) $now;
    $stmt->bind_param(
        'ssssss',
        $sessionId,
        $from,
        $to,
        $type,
        $encodedData,
        $createdAt
    );
    $stmt->execute();
    touchSession($sessionId, $now);
    return (int) db()->insert_id;
}

function latestSignalSeq(string $sessionId): int {
    $stmt = db()->prepare(
        'SELECT MAX(seq) AS latest_seq
         FROM ' . SIGNALS_TABLE . '
         WHERE session_id = ?'
    );
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return (int) ($row['latest_seq'] ?? 0);
}

function pollSignals(string $sessionId, string $to, int $since): array {
    $stmt = db()->prepare(
        'SELECT
            seq,
            from_peer,
            to_peer,
            signal_type,
            signal_data,
            created_at_ms
         FROM ' . SIGNALS_TABLE . '
         WHERE session_id = ? AND to_peer = ? AND seq > ?
         ORDER BY seq ASC
         LIMIT 200'
    );
    $stmt->bind_param('ssi', $sessionId, $to, $since);
    $stmt->execute();
    $result = $stmt->get_result();
    $messages = [];
    $cursor = $since;
    while ($row = $result->fetch_assoc()) {
        $seq = (int) $row['seq'];
        $messages[] = [
            'seq' => $seq,
            'from' => $row['from_peer'],
            'to' => $row['to_peer'],
            'type' => $row['signal_type'],
            'data' => json_decode($row['signal_data'], true),
            'createdAt' => (int) $row['created_at_ms'],
        ];
        $cursor = max($cursor, $seq);
    }
    return [
        'messages' => $messages,
        'cursor' => $cursor,
    ];
}

function db(): mysqli {
    static $db = null;
    if ($db instanceof mysqli) {
        return $db;
    }

    $host = configValue(['PLAYGROUND_RELAY_DB_HOST', 'DB_HOST']);
    $user = configValue(['PLAYGROUND_RELAY_DB_USER', 'DB_USER']);
    $password = configValue([
        'PLAYGROUND_RELAY_DB_PASSWORD',
        'DB_PASSWORD',
    ], false);
    $name = configValue(['PLAYGROUND_RELAY_DB_NAME', 'DB_NAME']);
    $port = (int) (configValue([
        'PLAYGROUND_RELAY_DB_PORT',
        'DB_PORT',
    ], false) ?? 3306);

    if (!$host || !$user || !$name) {
        throw new RuntimeException('Remote access relay DB config is incomplete.');
    }

    $db = mysqli_init();
    $db->real_connect($host, $user, $password ?? '', $name, $port);
    $db->set_charset('utf8mb4');
    return $db;
}

function configValue(array $keys, bool $required = true): ?string {
    foreach ($keys as $key) {
        if (defined($key)) {
            $value = constant($key);
            if ($value !== '' && $value !== false && $value !== null) {
                return (string) $value;
            }
        }
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
            return (string) $_SERVER[$key];
        }
    }
    if ($required) {
        throw new RuntimeException('Missing config value: ' . implode(' or ', $keys));
    }
    return null;
}

function recordGuestHeartbeat(string $sessionId, string $guestId, int $now): void {
    $stmt = db()->prepare(
        'INSERT INTO ' . GUESTS_TABLE . '
            (session_id, guest_id, last_seen_at_ms)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_seen_at_ms = VALUES(last_seen_at_ms)'
    );
    $lastSeenAt = (string) $now;
    $stmt->bind_param('sss', $sessionId, $guestId, $lastSeenAt);
    $stmt->execute();
    touchSession($sessionId, $now);
}

function refreshHostState(array $session, int $now): void {
    if (!isHostAlive($session, $now)) {
        setHostConnected((string) $session['session_id'], false);
    }
}

function sessionStatus(array $session, int $now): array {
    $guestList = [];
    $deadline = $now - GUEST_DEAD_AFTER_MS;
    $stmt = db()->prepare(
        'DELETE FROM ' . GUESTS_TABLE . '
         WHERE session_id = ? AND last_seen_at_ms < ?'
    );
    $sessionId = (string) $session['session_id'];
    $deadlineMs = (string) $deadline;
    $stmt->bind_param('ss', $sessionId, $deadlineMs);
    $stmt->execute();

    $stmt = db()->prepare(
        'SELECT guest_id, last_seen_at_ms FROM ' . GUESTS_TABLE . '
         WHERE session_id = ?
         ORDER BY last_seen_at_ms DESC'
    );
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($guest = $result->fetch_assoc()) {
        $guestList[] = [
            'id' => $guest['guest_id'],
            'lastSeenMs' => $now - (int) $guest['last_seen_at_ms'],
        ];
    }

    $lastHostSeenAt = (int) ($session['last_host_seen_at_ms'] ?? 0);
    return [
        'sessionId' => $session['session_id'],
        'hostConnected' => (bool) ($session['host_connected'] ?? false),
        'hostAlive' => isHostAlive($session, $now),
        'lastPollAgoMs' => $lastHostSeenAt > 0 ? $now - $lastHostSeenAt : -1,
        'guests' => $guestList,
    ];
}

function isHostAlive(array $session, int $now): bool {
    $lastHostSeenAt = (int) ($session['last_host_seen_at_ms'] ?? 0);
    return !empty($session['host_connected']) &&
        $lastHostSeenAt > 0 &&
        $now - $lastHostSeenAt < HOST_DEAD_AFTER_MS;
}

function isValidSignal(string $from, string $to, string $type): bool {
    return in_array($from, ['host', 'guest'], true) &&
        in_array($to, ['host', 'guest'], true) &&
        $from !== $to &&
        in_array(
            $type,
            ['offer', 'answer', 'candidate', 'heartbeat', 'retry-request'],
            true
        );
}

function buildShareUrl(string $sessionId): string {
    $publicBase = getenv('PLAYGROUND_RELAY_PUBLIC_BASE_URL') ?: '';
    if ($publicBase !== '') {
        return rtrim($publicBase, '/') . '/?share=' . $sessionId;
    }

    $protocol = $_SERVER['HTTP_X_FORWARDED_PROTO'] ??
        ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http');
    $host = $_SERVER['HTTP_X_FORWARDED_HOST']
        ?? $_SERVER['HTTP_HOST']
        ?? 'localhost';
    $basePath = strpos($_SERVER['REQUEST_URI'] ?? '', '/website-server') === 0
        ? '/website-server/'
        : '/';

    return "{$protocol}://{$host}{$basePath}?share={$sessionId}";
}

function isExpired(array $session, int $now): bool {
    return $now - ($session['last_activity_ms'] ?? 0) > SESSION_TIMEOUT_MS;
}

function normalizeAccessCode(string $accessCode): string {
    $digits = preg_replace('/\D+/', '', $accessCode);
    if (strlen($digits) !== 6) {
        return '';
    }
    return substr($digits, 0, 3) . '-' . substr($digits, 3, 3);
}

function generateAccessCode(): string {
    $digits = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    return substr($digits, 0, 3) . '-' . substr($digits, 3, 3);
}

function generateUuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function nowMs(): int {
    return (int) (microtime(true) * 1000);
}

function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
}

function setCorsHeaders(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($origin !== '' && $host !== '') {
        $originHost = parse_url($origin, PHP_URL_HOST);
        $originPort = parse_url($origin, PHP_URL_PORT);
        $originAuthority = $originHost . ($originPort ? ':' . $originPort : '');
        if ($originAuthority === $host) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
