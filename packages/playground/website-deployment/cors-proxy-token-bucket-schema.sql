DROP TABLE IF EXISTS cors_proxy_token_bucket;
CREATE TABLE cors_proxy_token_bucket (
	remote_addr INET6 PRIMARY KEY,
	capacity SMALLINT UNSIGNED NOT NULL,
	tokens SMALLINT UNSIGNED NOT NULL,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	CHECK (capacity > 0 AND remaining_tokens < capacity)
);