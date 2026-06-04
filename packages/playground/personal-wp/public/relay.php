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
 * Sessions, requests and responses live behind a small storage interface
 * with two interchangeable backends:
 *
 * - file (default): JSON files under DATA_DIR. Sessions are read and
 *   written under flock() so concurrent polls cannot dispatch the same
 *   request twice. Good for dev, single-host setups, and Atomic-style
 *   filesystems where every PHP worker shares the same disk.
 * - mysql: relational tables in a MySQL database. Sessions and per-
 *   request rows are coordinated with InnoDB row-level locks
 *   (SELECT ... FOR UPDATE inside short transactions), giving the
 *   same exclusivity guarantees as flock() but across multiple hosts.
 *
 * Pick the backend with the PLAYGROUND_RELAY_BACKEND env var. The
 * default is `file`, so an out-of-the-box checkout still works without
 * any database setup.
 *
 * Configuration env vars:
 * - PLAYGROUND_RELAY_BACKEND         "file" (default) or "mysql".
 * - PLAYGROUND_RELAY_DATA_DIR        Directory for session/request files
 *                                    (file backend only).
 * - PLAYGROUND_RELAY_PUBLIC_BASE_URL Public-facing base URL for share links,
 *                                    e.g. http://localhost:5400/website-server/
 *                                    Falls back to deriving from request headers.
 *
 * MySQL credentials are read from the standard WordPress DB_HOST,
 * DB_USER, DB_PASSWORD, DB_NAME (and optional DB_PORT) constants when
 * defined — so the relay can drop into a wp-config environment with
 * zero extra setup — and fall back to env vars of the same name
 * otherwise.
 */

// Configuration
//
// SESSION_TIMEOUT_MS is just garbage collection for fully abandoned
// sessions. While the host is polling, lastActivity gets bumped on
// every /poll (every ~25s), so a live session never expires no
// matter how long the user keeps the tab open. After the host
// disconnects, the only thing the session is good for is letting
// guest tabs surface "Host disconnected" instead of "Session
// expired" — which takes seconds, not minutes — so we don't need
// the old half-hour grace period. Five minutes is comfortably
// longer than HOST_DEAD_AFTER_MS so cleanup never races the
// disconnect detection, and short enough that abandoned sessions
// don't pile up.
define('SESSION_TIMEOUT_MS', 5 * 60 * 1000);      // 5 minutes
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

/**
 * Storage abstraction. The relay never touches files or SQL directly
 * — it goes through this interface so the request handlers don't have
 * to care which backend is in use.
 *
 * Atomicity guarantees the implementations must provide:
 *
 * - withSession() runs the callback with an exclusive hold on the
 *   session row/file so concurrent /poll, /status and /close requests
 *   can't interleave their reads and writes. lastActivity is bumped
 *   on every successful return so the caller never has to remember.
 *
 * - claimNextRequest() returns at most one undispatched request and
 *   atomically marks it dispatched. Two pollers racing on the same
 *   session must never both walk away with the same request.
 */
interface RelayStorage {
    /**
     * Persist a freshly-built session. Called from /session.
     */
    public function createSession(string $sessionId, array $session): void;

    /**
     * Hand the parsed session to $cb under an exclusive lock, then
     * write it back. Returns whatever the callback returned, or null
     * when the session does not exist or has expired.
     *
     * The callback receives the session by reference and may mutate
     * it freely. lastActivity is bumped automatically on write so the
     * caller never has to remember.
     *
     * This is the only correct way to read or modify a session —
     * direct reads race with the host poll and the cleanup task.
     */
    public function withSession(string $sessionId, Closure $cb);

    /**
     * Resolve a short desktop access code to its live session.
     */
    public function resolveAccessCode(string $accessCode): ?array;

    /**
     * Atomically claim the next undispatched request for a session
     * and return its tunnel-request payload. Returns null when there
     * is nothing to dispatch.
     */
    public function claimNextRequest(string $sessionId): ?array;

    /**
     * Queue a new tunnel request for the host to pick up.
     */
    public function saveRequest(string $sessionId, string $requestId, array $request): void;

    /**
     * Whether a queued request is still in storage. Used by the
     * guest wait loop to detect a /close that wiped its request.
     */
    public function requestExists(string $sessionId, string $requestId): bool;

    /**
     * Remove a queued request. Called from the guest wait loop after
     * the response has been delivered, on timeout, and on disconnect.
     */
    public function deleteRequest(string $sessionId, string $requestId): void;

    /**
     * Persist a tunnel response sent by the host.
     */
    public function saveResponse(string $sessionId, string $requestId, array $response): void;

    /**
     * Fetch a stored response, or null if the host hasn't replied yet.
     */
    public function getResponse(string $sessionId, string $requestId): ?array;

    /**
     * Remove a stored response after it has been delivered.
     */
    public function deleteResponse(string $sessionId, string $requestId): void;

    /**
     * Drop every queued request for a session. Used by /close
     * (and would-be cleanup paths) so guest wait loops time out fast
     * instead of hanging until REQUEST_TIMEOUT_SEC.
     */
    public function rejectPendingRequests(string $sessionId): void;

    /**
     * Periodic garbage collection. Removes expired sessions, their
     * requests, and any orphaned response rows. Called from the
     * 1%-per-request cleanup hook.
     */
    public function cleanup(int $now): void;
}

/**
 * File-system backed storage. JSON files live under $dataDir, with
 * one directory per category:
 *
 *   sessions/{sid}.json       — single session record
 *   requests/{sid}/{rid}.json — one file per queued tunnel request
 *   responses/{sid}/{rid}.json — one file per pending host response
 *
 * Concurrency is handled with flock(): a per-file LOCK_EX for sessions
 * and per-request LOCK_EX|LOCK_NB for the dispatch race in claimNextRequest.
 */
final class FileRelayStorage implements RelayStorage {
    private string $dataDir;

    public function __construct(string $dataDir) {
        $this->dataDir = $dataDir;
        // Ensure data directory exists. Use mkdir-then-recheck so two
        // concurrent requests racing to create the same dir don't blow up.
        $this->ensureDir($dataDir);
        $this->ensureDir($dataDir . '/sessions');
        $this->ensureDir($dataDir . '/requests');
        $this->ensureDir($dataDir . '/responses');
    }

    public function createSession(string $sessionId, array $session): void {
        $file = $this->dataDir . '/sessions/' . $sessionId . '.json';
        file_put_contents($file, json_encode($session));
    }

    public function withSession(string $sessionId, Closure $cb) {
        $file = $this->dataDir . '/sessions/' . $sessionId . '.json';
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

    public function resolveAccessCode(string $accessCode): ?array {
        $sessionFiles = glob($this->dataDir . '/sessions/*.json') ?: [];
        foreach ($sessionFiles as $file) {
            $session = json_decode(@file_get_contents($file) ?: '', true);
            if (
                is_array($session) &&
                ($session['accessCode'] ?? '') === $accessCode &&
                nowMs() - ($session['lastActivity'] ?? 0) <= SESSION_TIMEOUT_MS
            ) {
                return $session;
            }
        }
        return null;
    }

    public function claimNextRequest(string $sessionId): ?array {
        $requestsDir = $this->dataDir . '/requests/' . $sessionId;
        $this->ensureDir($requestsDir);
        $files = glob($requestsDir . '/*.json') ?: [];
        // Each candidate request file is opened under flock() so two
        // pollers cannot dispatch the same request twice (the original
        // code did a racy read-modify-write that could double-deliver).
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
                return $request['request'];
            }
            @flock($fh, LOCK_UN);
            fclose($fh);
        }
        return null;
    }

    public function saveRequest(string $sessionId, string $requestId, array $request): void {
        $requestsDir = $this->dataDir . '/requests/' . $sessionId;
        $this->ensureDir($requestsDir);
        file_put_contents(
            $requestsDir . '/' . $requestId . '.json',
            json_encode([
                'request' => $request,
                'dispatched' => false,
                'createdAt' => nowMs(),
            ])
        );
    }

    public function requestExists(string $sessionId, string $requestId): bool {
        return file_exists($this->requestPath($sessionId, $requestId));
    }

    public function deleteRequest(string $sessionId, string $requestId): void {
        @unlink($this->requestPath($sessionId, $requestId));
    }

    public function saveResponse(string $sessionId, string $requestId, array $response): void {
        $responsesDir = $this->dataDir . '/responses/' . $sessionId;
        $this->ensureDir($responsesDir);
        file_put_contents(
            $responsesDir . '/' . $requestId . '.json',
            json_encode($response)
        );
    }

    public function getResponse(string $sessionId, string $requestId): ?array {
        $file = $this->responsePath($sessionId, $requestId);
        if (!file_exists($file)) {
            return null;
        }
        $contents = @file_get_contents($file);
        if ($contents === false) {
            return null;
        }
        $decoded = json_decode($contents, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function deleteResponse(string $sessionId, string $requestId): void {
        @unlink($this->responsePath($sessionId, $requestId));
    }

    public function rejectPendingRequests(string $sessionId): void {
        $dir = $this->dataDir . '/requests/' . $sessionId;
        if (!is_dir($dir)) {
            return;
        }
        foreach (glob($dir . '/*.json') ?: [] as $file) {
            @unlink($file);
        }
    }

    public function cleanup(int $now): void {
        // Clean up old sessions
        $sessionFiles = glob($this->dataDir . '/sessions/*.json') ?: [];
        foreach ($sessionFiles as $file) {
            $session = json_decode(@file_get_contents($file) ?: '', true);
            if ($session && $now - ($session['lastActivity'] ?? 0) > SESSION_TIMEOUT_MS) {
                $sessionId = $session['sessionId'];
                @unlink($file);

                // Clean up session's requests and responses
                $requestsDir = $this->dataDir . '/requests/' . $sessionId;
                if (is_dir($requestsDir)) {
                    array_map('unlink', glob($requestsDir . '/*.json') ?: []);
                    @rmdir($requestsDir);
                }

                $responsesDir = $this->dataDir . '/responses/' . $sessionId;
                if (is_dir($responsesDir)) {
                    array_map('unlink', glob($responsesDir . '/*.json') ?: []);
                    @rmdir($responsesDir);
                }
            }
        }

        // Clean up orphaned request files (older than REQUEST_TIMEOUT_SEC * 2)
        $requestDirs = glob($this->dataDir . '/requests/*', GLOB_ONLYDIR) ?: [];
        foreach ($requestDirs as $dir) {
            $files = glob($dir . '/*.json') ?: [];
            foreach ($files as $file) {
                if ($now / 1000 - filemtime($file) > REQUEST_TIMEOUT_SEC * 2) {
                    @unlink($file);
                }
            }
        }
    }

    private function requestPath(string $sessionId, string $requestId): string {
        return $this->dataDir . '/requests/' . $sessionId . '/' . $requestId . '.json';
    }

    private function responsePath(string $sessionId, string $requestId): string {
        return $this->dataDir . '/responses/' . $sessionId . '/' . $requestId . '.json';
    }

    /**
     * Create a directory if it doesn't already exist. Safe to call from
     * multiple processes at once: mkdir() is the only TOCTOU-free check —
     * we ignore its failure and only error out if the directory still
     * isn't there afterwards.
     */
    private function ensureDir(string $dir): void {
        if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
            throw new RuntimeException("Failed to create directory: $dir");
        }
    }
}

/**
 * MySQL backed storage. Three tables, one per category, all using
 * InnoDB so the row-level locks underpinning withSession() and
 * claimNextRequest() actually work. Schema is created lazily on
 * first connect via CREATE TABLE IF NOT EXISTS.
 *
 * Connection lifetime: a fresh PDO is opened on each PHP request,
 * which is fine for php -S / PHP-FPM / Atomic since each long-poll
 * iteration runs a short transaction (begin → SELECT FOR UPDATE →
 * UPDATE → commit) and then yields back to the loop.
 */
final class MysqlRelayStorage implements RelayStorage {
    private PDO $pdo;
    private string $sessionsTable = 'playground_relay_sessions';
    private string $requestsTable = 'playground_relay_requests';
    private string $responsesTable = 'playground_relay_responses';

    public function __construct() {
        // No defaults: a relay configured for mysql but missing
        // credentials should fail loudly rather than quietly try to
        // connect to localhost as root with an empty password. The
        // port is the only exception — 3306 is the universal MySQL
        // port and we treat it as a sensible default.
        $host     = self::requireConfig('DB_HOST');
        $user     = self::requireConfig('DB_USER');
        $password = self::requireConfig('DB_PASSWORD');
        $name     = self::requireConfig('DB_NAME');
        $port     = (int) (self::optionalConfig('DB_PORT') ?? 3306);

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
        $this->pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);

        // Cap row-lock waits at a small value so a crashed worker
        // holding a stale FOR UPDATE lock can't block a new poll for
        // the default 50 seconds. The relay's own retry loops will
        // catch any contention from this much faster.
        try {
            $this->pdo->exec('SET SESSION innodb_lock_wait_timeout = 5');
        } catch (Throwable $_) {
            // Older MySQL versions or non-InnoDB defaults — non-fatal.
        }

        $this->ensureSchema();
    }

    /**
     * Resolve a config value from a WordPress-style constant first,
     * then env vars (getenv() and $_SERVER for PHP-WASM). The
     * constant path lets the relay drop into a wp-config.php
     * environment without any extra wiring. Returns null when the
     * value is not set anywhere.
     */
    private static function optionalConfig(string $key): ?string {
        if (defined($key)) {
            $val = constant($key);
            if ($val !== '' && $val !== false && $val !== null) {
                return (string) $val;
            }
        }
        $env = getenv($key);
        if ($env !== false && $env !== '') {
            return $env;
        }
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
            return (string) $_SERVER[$key];
        }
        return null;
    }

    /**
     * Same as optionalConfig() but throws when the value is missing,
     * with a message that names the variable so the operator can fix
     * it. Used for DB credentials that have no safe default.
     */
    private static function requireConfig(string $key): string {
        $value = self::optionalConfig($key);
        if ($value === null) {
            throw new RuntimeException(
                "MysqlRelayStorage: required config {$key} is not set. " .
                "Define it as a PHP constant (WordPress wp-config.php style) " .
                "or set it as an environment variable."
            );
        }
        return $value;
    }

    /**
     * Idempotent table creation. Each PHP request re-issues these
     * statements; the cost is a couple of cheap metadata lookups
     * once the tables already exist, and we get zero-setup behaviour
     * for fresh databases.
     */
    private function ensureSchema(): void {
        $this->pdo->exec(
            "CREATE TABLE IF NOT EXISTS `{$this->sessionsTable}` (
                session_id VARCHAR(64) NOT NULL PRIMARY KEY,
                payload LONGTEXT NOT NULL,
                last_activity BIGINT NOT NULL,
                INDEX idx_last_activity (last_activity)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        $this->pdo->exec(
            "CREATE TABLE IF NOT EXISTS `{$this->requestsTable}` (
                session_id VARCHAR(64) NOT NULL,
                request_id VARCHAR(64) NOT NULL,
                payload LONGTEXT NOT NULL,
                dispatched TINYINT(1) NOT NULL DEFAULT 0,
                created_at BIGINT NOT NULL,
                PRIMARY KEY (session_id, request_id),
                INDEX idx_pending (session_id, dispatched, created_at),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        $this->pdo->exec(
            "CREATE TABLE IF NOT EXISTS `{$this->responsesTable}` (
                session_id VARCHAR(64) NOT NULL,
                request_id VARCHAR(64) NOT NULL,
                payload LONGTEXT NOT NULL,
                PRIMARY KEY (session_id, request_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }

    public function createSession(string $sessionId, array $session): void {
        $stmt = $this->pdo->prepare(
            "INSERT INTO `{$this->sessionsTable}` (session_id, payload, last_activity)
             VALUES (?, ?, ?)"
        );
        $stmt->execute([
            $sessionId,
            json_encode($session),
            (int) ($session['lastActivity'] ?? nowMs()),
        ]);
    }

    public function withSession(string $sessionId, Closure $cb) {
        // SELECT ... FOR UPDATE inside a transaction gives us the
        // same serialise-concurrent-modifications guarantee as the
        // file backend's flock(). The transaction stays short — we
        // read, hand the parsed payload to the callback, then either
        // UPDATE or DELETE before COMMIT.
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "SELECT payload FROM `{$this->sessionsTable}`
                 WHERE session_id = ? FOR UPDATE"
            );
            $stmt->execute([$sessionId]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->pdo->rollBack();
                return null;
            }
            $session = json_decode($row['payload'], true);
            if (!is_array($session)) {
                // Corrupt row — drop it like the file backend drops
                // an unparsable session file.
                $this->pdo
                    ->prepare("DELETE FROM `{$this->sessionsTable}` WHERE session_id = ?")
                    ->execute([$sessionId]);
                $this->pdo->commit();
                return null;
            }

            // Check expiry while we still hold the row lock so a
            // request arriving during cleanup races correctly.
            if (nowMs() - ($session['lastActivity'] ?? 0) > SESSION_TIMEOUT_MS) {
                $this->pdo
                    ->prepare("DELETE FROM `{$this->sessionsTable}` WHERE session_id = ?")
                    ->execute([$sessionId]);
                $this->pdo->commit();
                return null;
            }

            $result = $cb($session);

            $session['lastActivity'] = nowMs();
            $update = $this->pdo->prepare(
                "UPDATE `{$this->sessionsTable}`
                 SET payload = ?, last_activity = ?
                 WHERE session_id = ?"
            );
            $update->execute([
                json_encode($session),
                (int) $session['lastActivity'],
                $sessionId,
            ]);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    public function resolveAccessCode(string $accessCode): ?array {
        $deadline = nowMs() - SESSION_TIMEOUT_MS;
        $stmt = $this->pdo->prepare(
            "SELECT payload FROM `{$this->sessionsTable}`
             WHERE last_activity >= ?
             ORDER BY last_activity DESC"
        );
        $stmt->execute([$deadline]);
        while ($row = $stmt->fetch()) {
            $session = json_decode($row['payload'], true);
            if (
                is_array($session) &&
                ($session['accessCode'] ?? '') === $accessCode
            ) {
                return $session;
            }
        }
        return null;
    }

    public function claimNextRequest(string $sessionId): ?array {
        // SELECT ... FOR UPDATE picks the next undispatched request
        // and locks the row so a concurrent poll can't grab it. We
        // mark it dispatched in the same transaction and commit,
        // releasing the lock immediately.
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "SELECT request_id, payload
                 FROM `{$this->requestsTable}`
                 WHERE session_id = ? AND dispatched = 0
                 ORDER BY created_at ASC
                 LIMIT 1
                 FOR UPDATE"
            );
            $stmt->execute([$sessionId]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->pdo->commit();
                return null;
            }
            $update = $this->pdo->prepare(
                "UPDATE `{$this->requestsTable}`
                 SET dispatched = 1
                 WHERE session_id = ? AND request_id = ?"
            );
            $update->execute([$sessionId, $row['request_id']]);
            $this->pdo->commit();

            $envelope = json_decode($row['payload'], true);
            if (!is_array($envelope) || !isset($envelope['request'])) {
                return null;
            }
            return $envelope['request'];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    public function saveRequest(string $sessionId, string $requestId, array $request): void {
        $envelope = [
            'request' => $request,
            'dispatched' => false,
            'createdAt' => nowMs(),
        ];
        $stmt = $this->pdo->prepare(
            "INSERT INTO `{$this->requestsTable}`
             (session_id, request_id, payload, dispatched, created_at)
             VALUES (?, ?, ?, 0, ?)"
        );
        $stmt->execute([
            $sessionId,
            $requestId,
            json_encode($envelope),
            (int) $envelope['createdAt'],
        ]);
    }

    public function requestExists(string $sessionId, string $requestId): bool {
        $stmt = $this->pdo->prepare(
            "SELECT 1 FROM `{$this->requestsTable}`
             WHERE session_id = ? AND request_id = ?"
        );
        $stmt->execute([$sessionId, $requestId]);
        return (bool) $stmt->fetchColumn();
    }

    public function deleteRequest(string $sessionId, string $requestId): void {
        $stmt = $this->pdo->prepare(
            "DELETE FROM `{$this->requestsTable}`
             WHERE session_id = ? AND request_id = ?"
        );
        $stmt->execute([$sessionId, $requestId]);
    }

    public function saveResponse(string $sessionId, string $requestId, array $response): void {
        // The host should never deliver two responses for the same
        // request, but ON DUPLICATE KEY UPDATE keeps the relay
        // forgiving in case of a retry.
        $stmt = $this->pdo->prepare(
            "INSERT INTO `{$this->responsesTable}`
             (session_id, request_id, payload)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload)"
        );
        $stmt->execute([$sessionId, $requestId, json_encode($response)]);
    }

    public function getResponse(string $sessionId, string $requestId): ?array {
        $stmt = $this->pdo->prepare(
            "SELECT payload FROM `{$this->responsesTable}`
             WHERE session_id = ? AND request_id = ?"
        );
        $stmt->execute([$sessionId, $requestId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $decoded = json_decode($row['payload'], true);
        return is_array($decoded) ? $decoded : null;
    }

    public function deleteResponse(string $sessionId, string $requestId): void {
        $stmt = $this->pdo->prepare(
            "DELETE FROM `{$this->responsesTable}`
             WHERE session_id = ? AND request_id = ?"
        );
        $stmt->execute([$sessionId, $requestId]);
    }

    public function rejectPendingRequests(string $sessionId): void {
        $stmt = $this->pdo->prepare(
            "DELETE FROM `{$this->requestsTable}` WHERE session_id = ?"
        );
        $stmt->execute([$sessionId]);
    }

    public function cleanup(int $now): void {
        // Drop expired sessions and the requests / responses that
        // belong to them. Sessions go first so the orphan cleanup
        // below has a complete picture of who's still around.
        $sessionDeadline = $now - SESSION_TIMEOUT_MS;

        $expired = $this->pdo->prepare(
            "SELECT session_id FROM `{$this->sessionsTable}`
             WHERE last_activity < ?"
        );
        $expired->execute([$sessionDeadline]);
        $expiredIds = $expired->fetchAll(PDO::FETCH_COLUMN, 0);
        if ($expiredIds) {
            $placeholders = implode(',', array_fill(0, count($expiredIds), '?'));
            $this->pdo
                ->prepare("DELETE FROM `{$this->sessionsTable}` WHERE session_id IN ({$placeholders})")
                ->execute($expiredIds);
            $this->pdo
                ->prepare("DELETE FROM `{$this->requestsTable}` WHERE session_id IN ({$placeholders})")
                ->execute($expiredIds);
            $this->pdo
                ->prepare("DELETE FROM `{$this->responsesTable}` WHERE session_id IN ({$placeholders})")
                ->execute($expiredIds);
        }

        // Drop request rows that have lingered past the long-wait
        // window — same `REQUEST_TIMEOUT_SEC * 2` heuristic the
        // file backend uses for orphaned files.
        $requestDeadline = $now - REQUEST_TIMEOUT_SEC * 2 * 1000;
        $this->pdo
            ->prepare("DELETE FROM `{$this->requestsTable}` WHERE created_at < ?")
            ->execute([$requestDeadline]);

        // Sweep response rows whose session is gone. Responses don't
        // carry their own timestamp; they're cheap to leave behind
        // for short windows but we still want them gone eventually.
        $this->pdo->exec(
            "DELETE r FROM `{$this->responsesTable}` r
             LEFT JOIN `{$this->sessionsTable}` s
               ON s.session_id = r.session_id
             WHERE s.session_id IS NULL"
        );
    }
}

/**
 * Pick a backend based on PLAYGROUND_RELAY_BACKEND. Defaults to the
 * file backend so a fresh checkout works without any database setup.
 */
function makeRelayStorage(): RelayStorage {
    $backend = getenv('PLAYGROUND_RELAY_BACKEND')
        ?: ($_SERVER['PLAYGROUND_RELAY_BACKEND'] ?? 'file');
    if ($backend === 'mysql') {
        return new MysqlRelayStorage();
    }
    return new FileRelayStorage(DATA_DIR);
}

$storage = makeRelayStorage();

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
    handleCreateSession($storage);
} elseif (preg_match('#^/relay/code/([0-9-]+)$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    handleResolveAccessCode($storage, $matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/poll$#', $path, $matches)) {
    handlePoll($storage, $matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/status$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    handleStatus($storage, $matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/close$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleClose($storage, $matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/response/([^/]+)$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleResponse($storage, $matches[1], $matches[2]);
} elseif (preg_match('#^/relay/([^/]+)/batch-request$#', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleBatchGuestRequest($storage, $matches[1]);
} elseif (preg_match('#^/relay/([^/]+)/request(/.*)?$#', $path, $matches)) {
    handleGuestRequest($storage, $matches[1], $matches[2] ?? '/');
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// Run cleanup occasionally (1% chance per request)
if (rand(1, 100) === 1) {
    $storage->cleanup(nowMs());
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
 * Generate a six-digit access code formatted for reading aloud.
 */
function generateAccessCode(): string {
    $number = random_int(0, 999999);
    $digits = str_pad((string) $number, 6, '0', STR_PAD_LEFT);
    return substr($digits, 0, 3) . '-' . substr($digits, 3, 3);
}

function normalizeAccessCode(string $accessCode): string {
    $digits = preg_replace('/\D+/', '', $accessCode);
    if (strlen($digits) !== 6) {
        return '';
    }
    return substr($digits, 0, 3) . '-' . substr($digits, 3, 3);
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
function handleCreateSession(RelayStorage $storage): void {
    $sessionId = generateUuid();
    $accessCode = null;
    for ($i = 0; $i < 10; $i++) {
        $candidate = generateAccessCode();
        if (!$storage->resolveAccessCode($candidate)) {
            $accessCode = $candidate;
            break;
        }
    }
    if ($accessCode === null) {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Could not allocate access code']);
        return;
    }

    $now = nowMs();

    $session = [
        'sessionId' => $sessionId,
        'accessCode' => $accessCode,
        'createdAt' => $now,
        'lastActivity' => $now,
        'lastPollAt' => 0,
        'hostConnected' => false,
        'guests' => (object) [], // serialised as {} not []
        'nextGuestOrdinal' => 1,
    ];

    $storage->createSession($sessionId, $session);

    header('Content-Type: application/json');
    echo json_encode([
        'sessionId' => $sessionId,
        'shareUrl' => buildShareUrl($sessionId),
        'accessCode' => $accessCode,
    ]);
}

/**
 * Resolve a short desktop access code into the share URL.
 */
function handleResolveAccessCode(RelayStorage $storage, string $rawAccessCode): void {
    $accessCode = normalizeAccessCode($rawAccessCode);
    if ($accessCode === '') {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid access code']);
        return;
    }

    $session = $storage->resolveAccessCode($accessCode);
    if (!$session) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Access code not found']);
        return;
    }

    header('Content-Type: application/json');
    echo json_encode([
        'sessionId' => $session['sessionId'],
        'shareUrl' => buildShareUrl($session['sessionId']),
        'accessCode' => $accessCode,
    ]);
}

/**
 * Host polls for guest requests.
 */
function handlePoll(RelayStorage $storage, string $sessionId): void {
    // Mark host as connected and record this poll's timestamp under
    // a session lock so concurrent /status requests see fresh data.
    $session = $storage->withSession($sessionId, function (array &$session) {
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

    $startTime = time();

    // Long-poll: ask the storage for an undispatched request every
    // 100ms. The storage's claimNextRequest() handles the dispatch
    // race for us — file backend uses flock(), MySQL uses
    // SELECT ... FOR UPDATE.
    while (time() - $startTime < POLL_TIMEOUT_SEC) {
        $request = $storage->claimNextRequest($sessionId);
        if ($request !== null) {
            $requests = [$request];
            for ($i = 1; $i < 8; $i++) {
                $nextRequest = $storage->claimNextRequest($sessionId);
                if ($nextRequest === null) {
                    break;
                }
                $requests[] = $nextRequest;
            }
            header('Content-Type: application/json');
            echo json_encode([
                'request' => $request,
                'requests' => $requests,
            ]);
            return;
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
function handleStatus(RelayStorage $storage, string $sessionId): void {
    $now = nowMs();

    $queryString = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY) ?? '';
    parse_str($queryString, $queryParams);
    $guestId = isset($queryParams['gid']) ? (string) $queryParams['gid'] : null;

    $result = $storage->withSession($sessionId, function (array &$session) use ($guestId, $now) {
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
function handleClose(RelayStorage $storage, string $sessionId): void {
    $storage->withSession($sessionId, function (array &$session) {
        markHostDisconnected($session, 'host requested close');
    });
    // Drop in-flight guest requests so their long-wait loops bail
    // out instead of hanging for the full REQUEST_TIMEOUT_SEC.
    $storage->rejectPendingRequests($sessionId);

    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
}

/**
 * Host sends response for a request.
 */
function handleResponse(RelayStorage $storage, string $sessionId, string $requestId): void {
    $session = $storage->withSession($sessionId, function (array &$session) {
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

    $storage->saveResponse($sessionId, $requestId, $response);

    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
}

/**
 * Read the guest request body. PHP-FPM consumes multipart/form-data into
 * $_POST/$_FILES before userland can read php://input, so reconstruct that
 * body when the raw stream is empty. This keeps WordPress admin-ajax POSTs
 * working when they submit FormData.
 */
function readGuestRequestBody(array &$headers): ?string {
    $body = file_get_contents('php://input');
    if ($body !== '') {
        return $body;
    }

    $contentType = $headers['content-type'] ?? '';
    if (stripos($contentType, 'multipart/form-data') !== 0) {
        return null;
    }
    if (!preg_match('/boundary=([^;]+)/', $contentType, $matches)) {
        return null;
    }

    $boundary = trim($matches[1], "\"' \t\r\n");
    if ($boundary === '') {
        return null;
    }

    $parts = [];
    appendMultipartFields($parts, $_POST);
    appendMultipartFiles($parts, normalizeUploadedFiles($_FILES));
    if (!$parts) {
        return null;
    }

    $encoded = '';
    foreach ($parts as $part) {
        $encoded .= '--' . $boundary . "\r\n";
        $encoded .= $part['headers'];
        $encoded .= "\r\n\r\n";
        $encoded .= $part['body'];
        $encoded .= "\r\n";
    }
    $encoded .= '--' . $boundary . "--\r\n";
    $headers['content-length'] = (string) strlen($encoded);
    return $encoded;
}

function appendMultipartFields(array &$parts, array $fields, string $prefix = ''): void {
    foreach ($fields as $name => $value) {
        $fieldName = $prefix === '' ? (string) $name : "{$prefix}[{$name}]";
        if (is_array($value)) {
            appendMultipartFields($parts, $value, $fieldName);
            continue;
        }
        $parts[] = [
            'headers' => 'Content-Disposition: form-data; name="' . addcslashes($fieldName, "\\\"") . '"',
            'body' => (string) $value,
        ];
    }
}

function appendMultipartFiles(array &$parts, array $files, string $prefix = ''): void {
    foreach ($files as $name => $file) {
        $fieldName = $prefix === '' ? (string) $name : "{$prefix}[{$name}]";
        if (isset($file['children'])) {
            appendMultipartFiles($parts, $file['children'], $fieldName);
            continue;
        }
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }
        $tmpName = $file['tmp_name'] ?? '';
        $contents = is_string($tmpName) ? @file_get_contents($tmpName) : false;
        if ($contents === false) {
            continue;
        }
        $headers =
            'Content-Disposition: form-data; name="' .
            addcslashes($fieldName, "\\\"") .
            '"; filename="' .
            addcslashes((string) ($file['name'] ?? 'upload'), "\\\"") .
            '"';
        $type = $file['type'] ?? '';
        if (is_string($type) && $type !== '') {
            $headers .= "\r\nContent-Type: {$type}";
        }
        $parts[] = [
            'headers' => $headers,
            'body' => $contents,
        ];
    }
}

function normalizeUploadedFiles(array $files): array {
    $normalized = [];
    foreach ($files as $field => $file) {
        $normalized[$field] = normalizeUploadedFile($file);
    }
    return $normalized;
}

function normalizeUploadedFile(array $file): array {
    if (!is_array($file['name'] ?? null)) {
        return $file;
    }

    $children = [];
    foreach ($file['name'] as $key => $_) {
        $children[$key] = normalizeUploadedFile([
            'name' => $file['name'][$key],
            'type' => $file['type'][$key],
            'tmp_name' => $file['tmp_name'][$key],
            'error' => $file['error'][$key],
            'size' => $file['size'][$key],
        ]);
    }
    return ['children' => $children];
}

/**
 * Guest makes a request through the relay.
 */
function handleGuestRequest(RelayStorage $storage, string $sessionId, string $requestPath): void {
    $session = waitForConnectedHost($storage, $sessionId);
    if (!$session) {
        return;
    }

    $requestId = generateUuid();

    $headers = collectGuestRequestHeaders();

    // Read request body. Multipart requests may need reconstruction
    // because PHP-FPM consumes them before php://input is available.
    $body = readGuestRequestBody($headers);
    if ($body === null) {
        unset($headers['content-length']);
    }

    // Create the tunnel request
    $tunnelRequest = [
        'requestId' => $requestId,
        'method' => $_SERVER['REQUEST_METHOD'],
        'path' => $requestPath,
        'headers' => $headers,
        'body' => $body !== '' ? $body : null,
    ];

    // Save the request for the host to pick up
    $storage->saveRequest($sessionId, $requestId, $tunnelRequest);

    $response = waitForRelayResponse($storage, $sessionId, $requestId);
    if ($response === null) {
        return;
    }

    sendRelayResponse($response);
}

function waitForConnectedHost(RelayStorage $storage, string $sessionId): ?array {
    // Briefly wait for the host to be polling. There is an inherent
    // race between the host calling startSharing (which kicks off
    // /poll in the background, not awaited) and a guest opening the
    // share link milliseconds later: the guest's first /request/ may
    // land on the relay before the host's first /poll has set
    // hostConnected. With an in-process middleware everything is
    // synchronous and the race is invisible, but the file-based PHP
    // relay loses it routinely. Cap the wait at HOST_CONNECT_WAIT_SEC
    // so a genuinely stale share link still 503s in good time.
    $connectDeadline = time() + 5;
    $session = null;
    while (true) {
        $session = $storage->withSession($sessionId, function (array &$session) {
            // Age-out check so a guest request that arrives first
            // after the host disappears doesn't pin a worker for
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
            return null;
        }

        if (!empty($session['hostConnected'])) {
            return $session;
        }

        if (time() >= $connectDeadline) {
            http_response_code(503);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Host not connected']);
            return null;
        }

        usleep(100000); // 100ms
    }
}

function collectGuestRequestHeaders(): array {
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
    // When the relay sits behind a reverse proxy (vite dev's
    // changeOrigin proxy, Atomic's load balancer, …) the Host header
    // arriving here points at the relay process itself rather than
    // at the public website the guest actually loaded. The host's
    // TunnelHost uses this header to rewrite absolute WordPress URLs
    // in the HTML response, so passing the wrong value silently
    // breaks asset loading on the guest. Prefer X-Forwarded-Host
    // when present so the host sees the public origin.
    if (!empty($_SERVER['HTTP_X_FORWARDED_HOST'])) {
        $headers['host'] = $_SERVER['HTTP_X_FORWARDED_HOST'];
    }
    return $headers;
}

function handleBatchGuestRequest(RelayStorage $storage, string $sessionId): void {
    $session = waitForConnectedHost($storage, $sessionId);
    if (!$session) {
        return;
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    $requests = is_array($payload['requests'] ?? null) ? $payload['requests'] : [];
    $requestIds = [];
    foreach ($requests as $request) {
        if (!is_array($request)) {
            continue;
        }
        $requestId = (string)($request['requestId'] ?? '');
        $method = strtoupper((string)($request['method'] ?? 'GET'));
        $path = (string)($request['path'] ?? '/');
        if ($requestId === '' || !in_array($method, ['GET', 'HEAD'], true)) {
            continue;
        }
        $headers = is_array($request['headers'] ?? null) ? $request['headers'] : [];
        if (empty($headers['host'])) {
            $headers['host'] =
                $_SERVER['HTTP_X_FORWARDED_HOST'] ??
                $_SERVER['HTTP_HOST'] ??
                '';
        }
        $tunnelRequest = [
            'requestId' => $requestId,
            'method' => $method,
            'path' => $path === '' ? '/' : $path,
            'headers' => $headers,
            'body' => null,
        ];
        $storage->saveRequest($sessionId, $requestId, $tunnelRequest);
        $requestIds[] = $requestId;
    }

    $responses = waitForRelayResponses($storage, $sessionId, $requestIds, false);
    header('Content-Type: application/json');
    echo json_encode(['responses' => $responses]);
}

function waitForRelayResponse(RelayStorage $storage, string $sessionId, string $requestId): ?array {
    $responses = waitForRelayResponses($storage, $sessionId, [$requestId]);
    if (!$responses) {
        return null;
    }
    return $responses[0];
}

function waitForRelayResponses(RelayStorage $storage, string $sessionId, array $requestIds, bool $emitErrors = true): array {
    // Wait for response. Re-check session health every ~1s so we
    // can fail fast if the host disconnects mid-wait instead of
    // sitting around for the full timeout.
    $startTime = time();
    $lastHealthCheck = 0;

    $pending = array_fill_keys($requestIds, true);
    $responses = [];

    while ($pending && time() - $startTime < REQUEST_TIMEOUT_SEC) {
        foreach (array_keys($pending) as $requestId) {
            $response = $storage->getResponse($sessionId, $requestId);
            if ($response !== null) {
                $storage->deleteResponse($sessionId, $requestId);
                $storage->deleteRequest($sessionId, $requestId);
                $responses[] = $response;
                unset($pending[$requestId]);
            }
        }
        if (!$pending) {
            return $responses;
        }

        // If close() deleted our request, the host won't see it
        // any more — bail out instead of waiting for the timer.
        foreach (array_keys($pending) as $requestId) {
            if ($storage->requestExists($sessionId, $requestId)) {
                continue;
            }
            unset($pending[$requestId]);
        }
        if (!$pending && !$responses) {
            if ($emitErrors) {
                http_response_code(503);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Host disconnected']);
            }
            return [];
        }

        // Periodic re-check: did the host stop polling while we
        // were waiting? Reading the session is cheap and lets us
        // bail out within ~1s of a disconnect.
        $nowSec = time();
        if ($nowSec - $lastHealthCheck >= 1) {
            $lastHealthCheck = $nowSec;
            $check = $storage->withSession($sessionId, function (array &$session) {
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
                foreach (array_keys($pending) as $requestId) {
                    $storage->deleteRequest($sessionId, $requestId);
                }
                if ($emitErrors && !$responses) {
                    http_response_code(503);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Host disconnected']);
                }
                return $responses;
            }
        }

        usleep(50000); // 50ms
    }

    // Timeout - clean up and return error
    foreach (array_keys($pending) as $requestId) {
        $storage->deleteRequest($sessionId, $requestId);
    }

    if ($emitErrors && !$responses) {
        http_response_code(504);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Gateway timeout']);
    }
    return $responses;
}

function sendRelayResponse(array $response): void {
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
}
