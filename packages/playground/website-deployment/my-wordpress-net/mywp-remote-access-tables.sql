CREATE TABLE IF NOT EXISTS playground_remote_access_sessions (
	`session_id` CHAR(36) NOT NULL,
	`access_code` CHAR(7) NOT NULL,
	`host_token` CHAR(64) NOT NULL DEFAULT '',
	`created_at_ms` BIGINT UNSIGNED NOT NULL,
	`last_activity_ms` BIGINT UNSIGNED NOT NULL,
	`last_host_seen_at_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	`host_connected` TINYINT(1) NOT NULL DEFAULT 0,
	PRIMARY KEY (`session_id`),
	UNIQUE KEY `access_code` (`access_code`),
	INDEX (`last_activity_ms`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_remote_access_signals (
	`seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	`session_id` CHAR(36) NOT NULL,
	`from_peer` ENUM('host', 'guest') NOT NULL,
	`to_peer` ENUM('host', 'guest') NOT NULL,
	`signal_type` ENUM('offer', 'answer', 'candidate', 'retry-request') NOT NULL,
	`signal_data` VARCHAR(8192) NOT NULL,
	`created_at_ms` BIGINT UNSIGNED NOT NULL,
	PRIMARY KEY (`seq`),
	INDEX `poll_signals` (`session_id`, `to_peer`, `seq`),
	INDEX (`created_at_ms`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS playground_remote_access_guests (
	`session_id` CHAR(36) NOT NULL,
	`guest_id` CHAR(36) NOT NULL,
	`last_seen_at_ms` BIGINT UNSIGNED NOT NULL,
	PRIMARY KEY (`session_id`, `guest_id`),
	INDEX (`last_seen_at_ms`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*
 * Adds host_token to sessions tables created before it existed. Written as a
 * prepared statement because ADD COLUMN IF NOT EXISTS is MariaDB-only, and
 * this file is replayed on every deploy.
 *
 * Sessions that predate the column keep an empty token, which the relay
 * rejects. They expire within five minutes of the deploy.
 */
SET @add_host_token := (
	SELECT IF(
		COUNT(*) = 0,
		'ALTER TABLE playground_remote_access_sessions
			ADD COLUMN `host_token` CHAR(64) NOT NULL DEFAULT \'\' AFTER `access_code`',
		'DO 0'
	)
	FROM information_schema.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'playground_remote_access_sessions'
		AND COLUMN_NAME = 'host_token'
);
PREPARE add_host_token FROM @add_host_token;
EXECUTE add_host_token;
DEALLOCATE PREPARE add_host_token;
