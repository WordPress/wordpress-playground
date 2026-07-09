/**
 * Redis integration tests.
 *
 * These tests require a real Redis server running. Set REDIS_HOST and
 * optionally REDIS_PORT environment variables to run these tests.
 *
 * Example:
 *   REDIS_HOST=127.0.0.1 REDIS_PORT=6379 npx nx run php-wasm-node:test-redis-network-jspi
 *
 * Note: Redis requires JSPI for proper exception handling during network
 * operations. These tests are skipped when JSPI is not available.
 */

import {
	PHP,
	SupportedPHPVersions,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

// Check JSPI availability at module load time (top-level await)
const isJspiAvailable = await jspi();

const REDIS_HOST = process.env['REDIS_HOST'];
const REDIS_PORT = process.env['REDIS_PORT'] || '6379';

// Skip all Redis tests if JSPI is not available or REDIS_HOST is not set
if (!isJspiAvailable) {
	describe.skip('Redis Extension (requires JSPI)', () => {
		it('skipped - JSPI not available', () => {});
	});
	describe.skip('Redis Network Integration (requires JSPI)', () => {
		it('skipped - JSPI not available', () => {});
	});
} else if (!REDIS_HOST) {
	console.log(`
		Failing Redis network tests because no Redis server is configured.
		To run Redis tests, set the following environment variables:
		- REDIS_HOST (required, e.g., 127.0.0.1)
		- REDIS_PORT (optional, defaults to 6379)
	`);
	describe('Redis Extension (requires REDIS_HOST)', () => {
		it('skipped - REDIS_HOST not set', () => {
			throw new Error('REDIS_HOST not set');
		});
	});
} else {
	const phpVersions =
		'PHP' in process.env
			? [process.env['PHP']! as SupportedPHPVersion]
			: SupportedPHPVersions;

	/**
	 * PHP helper function that creates a configured Redis instance with proper
	 * timeout settings for WebSocket-based TCP connections.
	 */
	const createRedisPHP = () => `
	function createRedis() {
		$r = new Redis();
		// Set timeouts to give WebSocket proxy time to connect
		$r->connect('${REDIS_HOST}', ${REDIS_PORT}, 5.0);
		return $r;
	}
`;

	/**
	 * Test that the Redis extension loads and provides the expected API.
	 * This test does not require a running Redis server.
	 */
	describe('Redis Extension', () => {
		describe.each(phpVersions)('PHP %s', (phpVersion) => {
			let php: PHP;

			beforeEach(async () => {
				php = new PHP(
					await loadNodeRuntime(phpVersion as any, {
						extensions: ['redis'],
					})
				);
			});

			afterEach(() => {
				php?.exit();
			});

			it('loads the redis extension', async () => {
				const result = await php.run({
					code: `<?php
					echo extension_loaded('redis') ? 'LOADED' : 'NOT_LOADED';
				?>`,
				});
				expect(result.text).toBe('LOADED');
				expect(result.errors).toBeFalsy();
			});

			it('can instantiate Redis class', async () => {
				const result = await php.run({
					code: `<?php
					$r = new Redis();
					echo ($r instanceof Redis) ? 'SUCCESS' : 'FAILED';
				?>`,
				});
				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('has expected methods available', async () => {
				const result = await php.run({
					code: `<?php
					$methods = [
						'connect', 'pconnect', 'close',
						'get', 'set', 'del', 'delete',
						'mget', 'mset',
						'incr', 'decr', 'incrBy', 'decrBy',
						'exists', 'expire', 'expireAt', 'ttl',
						'keys', 'scan', 'type',
						'hGet', 'hSet', 'hGetAll', 'hDel',
						'lPush', 'rPush', 'lPop', 'rPop', 'lRange',
						'sAdd', 'sMembers', 'sRem', 'sIsMember',
						'zAdd', 'zRange', 'zScore', 'zRem',
						'ping', 'info', 'flushAll', 'flushDb',
						'select', 'auth'
					];
					$missing = [];
					foreach ($methods as $method) {
						if (!method_exists('Redis', $method)) {
							$missing[] = $method;
						}
					}
					echo empty($missing) ? 'ALL_PRESENT' : 'MISSING: ' . implode(', ', $missing);
				?>`,
				});
				expect(result.text).toBe('ALL_PRESENT');
				expect(result.errors).toBeFalsy();
			});

			it('has expected constants defined', async () => {
				const result = await php.run({
					code: `<?php
					$constants = [
						'Redis::REDIS_STRING',
						'Redis::REDIS_SET',
						'Redis::REDIS_LIST',
						'Redis::REDIS_ZSET',
						'Redis::REDIS_HASH',
						'Redis::REDIS_NOT_FOUND'
					];
					$missing = [];
					foreach ($constants as $const) {
						if (!defined($const)) {
							$missing[] = $const;
						}
					}
					echo empty($missing) ? 'ALL_DEFINED' : 'MISSING: ' . implode(', ', $missing);
				?>`,
				});
				expect(result.text).toBe('ALL_DEFINED');
				expect(result.errors).toBeFalsy();
			});
		});
	});

	describe('Redis Network Integration', () => {
		describe.each(phpVersions)('PHP %s', (phpVersion) => {
			let php: PHP;

			beforeEach(async () => {
				php = new PHP(
					await loadNodeRuntime(phpVersion as any, {
						extensions: ['redis'],
					})
				);
			});

			afterEach(() => {
				php?.exit();
			});

			it('can connect to Redis server', async () => {
				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					// ping() returns true or '+PONG' depending on version
					$pong = $r->ping();

					if ($pong === true || $pong === '+PONG' || $pong === 'PONG') {
						echo 'CONNECTED';
					} else {
						echo 'PING_FAILED: ' . var_export($pong, true);
					}
				?>`,
				});

				expect(result.text).toBe('CONNECTED');
				expect(result.errors).toBeFalsy();
			});

			it('can set and get values', async () => {
				const testKey = `test_key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
				const testValue = 'Hello from PHP-WASM!';

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';
					$value = '${testValue}';

					// Set the value
					$setResult = $r->set($key, $value);
					if (!$setResult) {
						echo 'SET_FAILED';
						exit(1);
					}

					// Get the value back
					$retrieved = $r->get($key);
					if ($retrieved === false) {
						echo 'GET_FAILED';
						exit(1);
					}

					// Clean up
					$r->del($key);

					echo $retrieved;
				?>`,
				});

				expect(result.text).toBe(testValue);
				expect(result.errors).toBeFalsy();
			});

			it('honors a custom read timeout against a blocking Redis command', async () => {
				const testKey = `test_read_timeout_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					$r = new Redis();
					$r->connect('${REDIS_HOST}', ${REDIS_PORT}, 5.0);

					if (!defined('Redis::OPT_READ_TIMEOUT')) {
						echo json_encode([
							'outcome' => 'MISSING_OPT_READ_TIMEOUT',
						]);
						exit;
					}

					$key = '${testKey}';
					$r->del($key);
					$r->setOption(Redis::OPT_READ_TIMEOUT, 0.2);

					$start = microtime(true);
					$outcome = 'UNKNOWN';
					$error = null;

					try {
						$value = $r->blPop([$key], 2);
						$outcome = $value === false ? 'FALSE' : 'VALUE';
					} catch (Throwable $e) {
						$outcome = 'EXCEPTION';
						$error = $e->getMessage();
					}

					$elapsedMs = (int) round((microtime(true) - $start) * 1000);
					$r->close();

					echo json_encode([
						'outcome' => $outcome,
						'elapsedMs' => $elapsedMs,
						'error' => $error,
					]);
				?>`,
				});

				const timeoutResult = JSON.parse(result.text) as {
					outcome: string;
					elapsedMs: number;
					error: string | null;
				};
				expect(['EXCEPTION', 'FALSE']).toContain(timeoutResult.outcome);
				expect(timeoutResult.elapsedMs).toBeGreaterThanOrEqual(100);
				expect(timeoutResult.elapsedMs).toBeLessThan(1500);
				if (timeoutResult.outcome === 'EXCEPTION') {
					expect(timeoutResult.error).toMatch(
						/read|socket|timed? out/i
					);
				}
			});

			it('can set values with expiration', async () => {
				const testKey = `test_expiry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Set with 1 hour expiration (using setex)
					$r->setex($key, 3600, 'test_value');

					// Verify it's there and has TTL
					$value = $r->get($key);
					$ttl = $r->ttl($key);

					// Clean up
					$r->del($key);

					echo ($value !== false && $ttl > 0) ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can delete values', async () => {
				const testKey = `test_delete_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Set a value
					$r->set($key, 'to_be_deleted');

					// Delete it
					$deleteResult = $r->del($key);

					// Try to get it (should return false)
					$value = $r->get($key);

					echo ($deleteResult >= 1 && $value === false) ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can increment and decrement values', async () => {
				const testKey = `test_incr_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Set initial value
					$r->set($key, 10);

					// Increment by 5
					$afterIncr = $r->incrBy($key, 5);

					// Decrement by 3
					$afterDecr = $r->decrBy($key, 3);

					// Clean up
					$r->del($key);

					// Should be 10 + 5 = 15, then 15 - 3 = 12
					echo "incr:$afterIncr,decr:$afterDecr";
				?>`,
				});

				expect(result.text).toBe('incr:15,decr:12');
				expect(result.errors).toBeFalsy();
			});

			it('can handle multiple keys with mget/mset', async () => {
				const prefix = `test_multi_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$prefix = '${prefix}';
					$items = [
						$prefix . '_key1' => 'value1',
						$prefix . '_key2' => 'value2',
						$prefix . '_key3' => 'value3',
					];

					// Set multiple values
					$r->mset($items);

					// Get multiple values
					$keys = array_keys($items);
					$retrieved = $r->mget($keys);

					// Clean up
					foreach ($keys as $key) {
						$r->del($key);
					}

					// Verify all values match (mget returns indexed array)
					$expected = array_values($items);
					$allMatch = ($retrieved === $expected);

					echo $allMatch ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can work with hash data structures', async () => {
				const testKey = `test_hash_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Set hash fields
					$r->hSet($key, 'name', 'John');
					$r->hSet($key, 'age', '30');
					$r->hSet($key, 'city', 'NYC');

					// Get individual field
					$name = $r->hGet($key, 'name');

					// Get all fields
					$all = $r->hGetAll($key);

					// Clean up
					$r->del($key);

					$isValid = (
						$name === 'John' &&
						$all['name'] === 'John' &&
						$all['age'] === '30' &&
						$all['city'] === 'NYC'
					);

					echo $isValid ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can work with list data structures', async () => {
				const testKey = `test_list_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Push items to list one at a time
					$r->rPush($key, 'first');
					$r->rPush($key, 'second');
					$r->rPush($key, 'third');

					// Get the length
					$len = $r->lLen($key);

					// Get first item using lIndex
					$first = $r->lIndex($key, 0);

					// Clean up
					$r->del($key);

					// Verify length and first item
					$isValid = ($len === 3 && $first === 'first');

					echo $isValid ? 'SUCCESS' : "FAILED: len=$len, first=$first";
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can work with set data structures', async () => {
				const testKey = `test_set_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Add members to set
					$r->sAdd($key, 'apple');
					$r->sAdd($key, 'banana');
					$r->sAdd($key, 'cherry');

					// Check membership
					$hasApple = $r->sIsMember($key, 'apple');
					$hasGrape = $r->sIsMember($key, 'grape');

					// Get all members
					$members = $r->sMembers($key);

					// Clean up
					$r->del($key);

					$isValid = (
						$hasApple === true &&
						$hasGrape === false &&
						count($members) === 3
					);

					echo $isValid ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can work with sorted set data structures', async () => {
				const testKey = `test_zset_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Add scored members
					$r->zAdd($key, 100, 'alice');
					$r->zAdd($key, 200, 'bob');
					$r->zAdd($key, 150, 'charlie');

					// Get range (sorted by score)
					$sorted = $r->zRange($key, 0, -1);

					// Get score
					$bobScore = $r->zScore($key, 'bob');

					// Clean up
					$r->del($key);

					$isValid = (
						count($sorted) === 3 &&
						$sorted[0] === 'alice' &&   // lowest score
						$sorted[1] === 'charlie' && // middle score
						$sorted[2] === 'bob' &&     // highest score
						$bobScore == 200
					);

					echo $isValid ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('handles non-existent keys gracefully', async () => {
				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$value = $r->get('definitely_does_not_exist_' . uniqid());

					echo ($value === false) ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can check if keys exist', async () => {
				const testKey = `test_exists_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// Check non-existent key
					$beforeSet = $r->exists($key);

					// Set key
					$r->set($key, 'value');

					// Check existing key
					$afterSet = $r->exists($key);

					// Clean up
					$r->del($key);

					echo (!$beforeSet && $afterSet) ? 'SUCCESS' : 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('can use setnx to only set if key does not exist', async () => {
				const testKey = `test_setnx_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$key = '${testKey}';

					// First setnx should succeed
					$first = $r->setnx($key, 'first_value');

					// Second setnx should fail (key exists)
					$second = $r->setnx($key, 'second_value');

					// Value should still be 'first_value'
					$value = $r->get($key);

					// Clean up
					$r->del($key);

					echo ($first && !$second && $value === 'first_value')
						? 'SUCCESS'
						: 'FAILED';
				?>`,
				});

				expect(result.text).toBe('SUCCESS');
				expect(result.errors).toBeFalsy();
			});

			it('setex serializes values the same as set (#3406)', async () => {
				const prefix = `test_setex_${Date.now()}_${Math.random().toString(36).substring(7)}`;

				const result = await php.run({
					code: `<?php
					${createRedisPHP()}
					$r = createRedis();

					$r->setOption(Redis::OPT_SERIALIZER, Redis::SERIALIZER_PHP);
					$r->set('${prefix}_set', [1, 2, 3]);
					$r->setex('${prefix}_setex', 3600, [1, 2, 3]);

					$r->setOption(Redis::OPT_SERIALIZER, Redis::SERIALIZER_NONE);
					$set_raw = $r->get('${prefix}_set');
					$setex_raw = $r->get('${prefix}_setex');

					$r->del('${prefix}_set');
					$r->del('${prefix}_setex');

					echo json_encode([
						'set' => $set_raw,
						'setex' => $setex_raw,
					]);
				?>`,
				});

				expect(result.errors).toBeFalsy();
				const results = JSON.parse(result.text);
				expect(results.setex).toBe(results.set);
			});
		});
	});
} // End of else block for JSPI/REDIS_HOST check
