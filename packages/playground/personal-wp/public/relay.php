<?php
/**
 * Minimal Personal WP desktop-access relay.
 *
 * This file is only a rendezvous/signaling service for the direct WebRTC
 * desktop tunnel. It stores session metadata plus small WebRTC messages
 * (offer, answer, ICE candidates, heartbeat). WordPress HTTP requests and
 * responses are not proxied through this PHP file.
 */

define('SESSION_TIMEOUT_MS', 5 * 60 * 1000);
define('HOST_DEAD_AFTER_MS', 40 * 1000);
define('GUEST_DEAD_AFTER_MS', 10 * 1000);
define('SIGNAL_POLL_TIMEOUT_SEC', 25);
define('SESSIONS_TABLE', 'mywp_desktop_access_sessions');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/website-server#', '', $path);

try {
    ensureSchema();

    if ($path === '/relay/session' && $_SERVER['REQUEST_METHOD'] === 'POST') {
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
    error_log('Desktop access relay error: ' . $e->getMessage());
    jsonResponse(['error' => $e->getMessage()], 500);
}

function handleCreateSession(): void {
    for ($i = 0; $i < 10; $i++) {
        $sessionId = generateUuid();
        $accessCode = generateAccessCode();
        $now = nowMs();
        $session = [
            'sessionId' => $sessionId,
            'accessCode' => $accessCode,
            'createdAt' => $now,
            'lastActivity' => $now,
            'lastHostSeenAt' => 0,
            'hostConnected' => false,
            'guests' => (object) [],
            'signals' => [],
            'nextSignalSeq' => 1,
        ];

        if (!insertSession($sessionId, $accessCode, $session, $now)) {
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
    $accessCode = normalizeAccessCode($rawAccessCode);
    if ($accessCode === '') {
        jsonResponse(['error' => 'Invalid access code'], 400);
        return;
    }

    $session = resolveAccessCode($accessCode);
    if (!$session) {
        jsonResponse(['error' => 'Access code not found'], 404);
        return;
    }

    jsonResponse([
        'sessionId' => $session['sessionId'],
        'shareUrl' => buildShareUrl($session['sessionId']),
        'accessCode' => $accessCode,
    ]);
}

function handleStatus(string $sessionId): void {
    $queryString = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY) ?? '';
    parse_str($queryString, $queryParams);
    $guestId = isset($queryParams['gid']) ? (string) $queryParams['gid'] : null;
    $now = nowMs();

    $result = withSession($sessionId, function (array &$session) use ($guestId, $now) {
        refreshHostState($session, $now);
        if ($guestId) {
            recordGuestHeartbeat($session, $guestId, $now);
        }
        return sessionStatus($session, $now);
    });

    if (!$result) {
        jsonResponse(['error' => 'Session not found'], 404);
        return;
    }
    jsonResponse($result);
}

function handlePostSignal(string $sessionId): void {
    $payload = json_decode(file_get_contents('php://input'), true);
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

    $result = withSession($sessionId, function (array &$session) use ($from, $to, $type, $payload) {
        $now = nowMs();
        if ($from === 'host') {
            $session['hostConnected'] = true;
            $session['lastHostSeenAt'] = $now;
        }

        if ($type === 'heartbeat') {
            return ['seq' => (int) (($session['nextSignalSeq'] ?? 1) - 1)];
        }

        $seq = (int) ($session['nextSignalSeq'] ?? 1);
        $session['nextSignalSeq'] = $seq + 1;
        $signals = is_array($session['signals'] ?? null)
            ? $session['signals']
            : [];
        $signals[] = [
            'seq' => $seq,
            'from' => $from,
            'to' => $to,
            'type' => $type,
            'data' => $payload['data'] ?? null,
            'createdAt' => $now,
        ];
        $session['signals'] = array_slice($signals, -200);
        return ['seq' => $seq];
    });

    if (!$result) {
        jsonResponse(['error' => 'Session not found'], 404);
        return;
    }
    jsonResponse(['ok' => true, 'seq' => $result['seq']]);
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

    $startTime = time();
    while (time() - $startTime < SIGNAL_POLL_TIMEOUT_SEC) {
        $now = nowMs();
        $result = withSession($sessionId, function (array &$session) use ($to, $since, $guestId, $now) {
            refreshHostState($session, $now);
            if ($to === 'guest' && $guestId) {
                recordGuestHeartbeat($session, $guestId, $now);
            }

            $messages = [];
            $cursor = $since;
            foreach (($session['signals'] ?? []) as $signal) {
                $seq = (int) ($signal['seq'] ?? 0);
                if (($signal['to'] ?? '') !== $to || $seq <= $since) {
                    continue;
                }
                $messages[] = $signal;
                $cursor = max($cursor, $seq);
            }

            return [
                'messages' => $messages,
                'cursor' => $cursor,
                'hostAlive' => isHostAlive($session, $now),
            ];
        });

        if (!$result) {
            jsonResponse(['error' => 'Session not found'], 404);
            return;
        }
        if ($result['messages']) {
            jsonResponse($result);
            return;
        }
        usleep(100000);
    }

    jsonResponse([
        'messages' => [],
        'cursor' => $since,
        'hostAlive' => true,
    ]);
}

function handleClose(string $sessionId): void {
    withSession($sessionId, function (array &$session) {
        $session['hostConnected'] = false;
    });
    jsonResponse(['ok' => true]);
}

function insertSession(
    string $sessionId,
    string $accessCode,
    array $session,
    int $now
): bool {
    $stmt = db()->prepare(
        'INSERT INTO ' . SESSIONS_TABLE . '
            (session_id, access_code, payload, created_at_ms, last_activity_ms)
         VALUES (?, ?, ?, ?, ?)'
    );
    $payload = json_encode($session);
    try {
        $stmt->bind_param('sssii', $sessionId, $accessCode, $payload, $now, $now);
        $stmt->execute();
        return true;
    } catch (mysqli_sql_exception $e) {
        if ((int) $e->getCode() === 1062) {
            return false;
        }
        throw $e;
    }
}

function withSession(string $sessionId, Closure $callback) {
    $db = db();
    $db->begin_transaction();
    try {
        $stmt = $db->prepare(
            'SELECT payload FROM ' . SESSIONS_TABLE . '
             WHERE session_id = ?
             FOR UPDATE'
        );
        $stmt->bind_param('s', $sessionId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            $db->commit();
            return null;
        }

        $session = json_decode($row['payload'], true);
        if (!is_array($session) || isExpired($session, nowMs())) {
            deleteSession($sessionId);
            $db->commit();
            return null;
        }

        $result = $callback($session);
        $now = nowMs();
        $session['lastActivity'] = $now;
        $payload = json_encode($session);
        $accessCode = (string) ($session['accessCode'] ?? '');
        $update = $db->prepare(
            'UPDATE ' . SESSIONS_TABLE . '
             SET access_code = ?, payload = ?, last_activity_ms = ?
             WHERE session_id = ?'
        );
        $update->bind_param('ssis', $accessCode, $payload, $now, $sessionId);
        $update->execute();
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

function resolveAccessCode(string $accessCode): ?array {
    $deadline = nowMs() - SESSION_TIMEOUT_MS;
    $stmt = db()->prepare(
        'SELECT session_id, payload FROM ' . SESSIONS_TABLE . '
         WHERE access_code = ? AND last_activity_ms >= ?
         LIMIT 1'
    );
    $stmt->bind_param('si', $accessCode, $deadline);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }

    $session = json_decode($row['payload'], true);
    if (!is_array($session) || isExpired($session, nowMs())) {
        deleteSession((string) $row['session_id']);
        return null;
    }
    return $session;
}

function deleteSession(string $sessionId): void {
    $stmt = db()->prepare('DELETE FROM ' . SESSIONS_TABLE . ' WHERE session_id = ?');
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
}

function cleanupSessions(): void {
    $deadline = nowMs() - SESSION_TIMEOUT_MS;
    $stmt = db()->prepare(
        'DELETE FROM ' . SESSIONS_TABLE . ' WHERE last_activity_ms < ?'
    );
    $stmt->bind_param('i', $deadline);
    $stmt->execute();
}

function db(): mysqli {
    static $db = null;
    if ($db instanceof mysqli) {
        return $db;
    }

    $host = configValue(['PLAYGROUND_RELAY_DB_HOST', 'MYWP_DB_HOST', 'DB_HOST']);
    $user = configValue(['PLAYGROUND_RELAY_DB_USER', 'MYWP_DB_USER', 'DB_USER']);
    $password = configValue([
        'PLAYGROUND_RELAY_DB_PASSWORD',
        'MYWP_DB_PASSWORD',
        'DB_PASSWORD',
    ], false);
    $name = configValue(['PLAYGROUND_RELAY_DB_NAME', 'MYWP_DB_NAME', 'DB_NAME']);
    $port = (int) (configValue([
        'PLAYGROUND_RELAY_DB_PORT',
        'MYWP_DB_PORT',
        'DB_PORT',
    ], false) ?? 3306);

    if (!$host || !$user || !$name) {
        throw new RuntimeException('Desktop access relay DB config is incomplete.');
    }

    $db = mysqli_init();
    $db->real_connect($host, $user, $password ?? '', $name, $port);
    $db->set_charset('utf8mb4');
    return $db;
}

function ensureSchema(): void {
    db()->query(
        'CREATE TABLE IF NOT EXISTS ' . SESSIONS_TABLE . ' (
            session_id varchar(64) NOT NULL PRIMARY KEY,
            access_code varchar(7) NOT NULL UNIQUE,
            payload json NOT NULL,
            created_at_ms bigint unsigned NOT NULL,
            last_activity_ms bigint unsigned NOT NULL,
            KEY access_code_idx (access_code),
            KEY last_activity_idx (last_activity_ms)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
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

function recordGuestHeartbeat(array &$session, string $guestId, int $now): void {
    $guests = is_array($session['guests'] ?? null) ? $session['guests'] : [];
    $guests[$guestId] = [
        'id' => $guestId,
        'lastSeenAt' => $now,
    ];
    $session['guests'] = $guests;
}

function refreshHostState(array &$session, int $now): void {
    if (!isHostAlive($session, $now)) {
        $session['hostConnected'] = false;
    }
}

function sessionStatus(array &$session, int $now): array {
    $guestList = [];
    $survivors = [];
    foreach (($session['guests'] ?? []) as $guest) {
        if ($now - ($guest['lastSeenAt'] ?? 0) <= GUEST_DEAD_AFTER_MS) {
            $survivors[$guest['id']] = $guest;
            $guestList[] = [
                'id' => $guest['id'],
                'lastSeenMs' => $now - ($guest['lastSeenAt'] ?? $now),
            ];
        }
    }
    $session['guests'] = $survivors;

    $lastHostSeenAt = (int) ($session['lastHostSeenAt'] ?? 0);
    return [
        'sessionId' => $session['sessionId'],
        'hostConnected' => (bool) ($session['hostConnected'] ?? false),
        'hostAlive' => isHostAlive($session, $now),
        'lastPollAgoMs' => $lastHostSeenAt > 0 ? $now - $lastHostSeenAt : -1,
        'guests' => $guestList,
    ];
}

function isHostAlive(array $session, int $now): bool {
    $lastHostSeenAt = (int) ($session['lastHostSeenAt'] ?? 0);
    return !empty($session['hostConnected']) &&
        $lastHostSeenAt > 0 &&
        $now - $session['lastHostSeenAt'] < HOST_DEAD_AFTER_MS;
}

function isValidSignal(string $from, string $to, string $type): bool {
    return in_array($from, ['host', 'guest'], true) &&
        in_array($to, ['host', 'guest'], true) &&
        $from !== $to &&
        in_array($type, ['offer', 'answer', 'candidate', 'heartbeat'], true);
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
    return $now - ($session['lastActivity'] ?? 0) > SESSION_TIMEOUT_MS;
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
    echo json_encode($data);
}
