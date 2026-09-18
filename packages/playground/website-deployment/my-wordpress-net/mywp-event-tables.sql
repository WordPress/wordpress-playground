CREATE TABLE IF NOT EXISTS mywp_event_stats_daily (
	`date` DATE NOT NULL,
	`name` VARCHAR(80) NOT NULL,
	`value` VARCHAR(128) NOT NULL,
	`views` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`date`, `name`, `value`),
	INDEX (`name`, `date`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mywp_event_stats_hourly (
	`hour` DATETIME NOT NULL,
	`name` VARCHAR(80) NOT NULL,
	`value` VARCHAR(128) NOT NULL,
	`views` BIGINT UNSIGNED NOT NULL DEFAULT 0,
	`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`hour`, `name`, `value`),
	INDEX (`name`, `hour`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mywp_event_rate_limiting (
	`remote_key` CHAR(64) NOT NULL PRIMARY KEY,
	`capacity` SMALLINT UNSIGNED NOT NULL,
	`fill_rate_per_minute` SMALLINT UNSIGNED NOT NULL,
	`tokens` SMALLINT UNSIGNED NOT NULL,
	`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	CHECK (`capacity` > 0 AND `tokens` < `capacity`),
	INDEX (`updated_at`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
