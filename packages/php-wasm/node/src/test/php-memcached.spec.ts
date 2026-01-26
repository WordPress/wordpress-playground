/**
 * Memcached integration tests.
 *
 * The "Memcached Extension" tests verify that the extension loads and provides
 * the expected API. These do not require a running memcached server.
 *
 * The "Memcached Network Integration" tests require a running memcached server
 * and the MEMCACHED_HOST environment variable to be set. These tests will fail
 * if the environment is not properly configured.
 *
 * To run network tests locally:
 *   docker run -d -p 11211:11211 memcached:1.6-alpine
 *   MEMCACHED_HOST=127.0.0.1 npx vitest run php-memcached
 *
 * Note: Network tests verify that the memcached extension can communicate
 * with a real memcached server. In WebAssembly, TCP connections are proxied
 * through WebSockets, which may have timing differences compared to native
 * socket implementations.
 */

import { PHP, SupportedPHPVersions, type SupportedPHPVersion } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const MEMCACHED_HOST = process.env['MEMCACHED_HOST'];
const MEMCACHED_PORT = process.env['MEMCACHED_PORT'] || '11211';

const phpVersions =
	'PHP' in process.env
		? [process.env['PHP']! as SupportedPHPVersion]
		: SupportedPHPVersions;

/**
 * Test that the memcached extension loads and provides the expected API.
 * This test does not require a running memcached server.
 */
describe('Memcached Extension', () => {
	describe.each(phpVersions)('PHP %s', (phpVersion) => {
		let php: PHP;

		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withMemcached: true })
			);
		});

		afterEach(() => {
			php?.exit();
		});

		it('loads the memcached extension', async () => {
			const result = await php.run({
				code: `<?php
					echo extension_loaded('memcached') ? 'LOADED' : 'NOT_LOADED';
				?>`,
			});
			expect(result.text).toBe('LOADED');
			expect(result.errors).toBeFalsy();
		});

		it('can instantiate Memcached class', async () => {
			const result = await php.run({
				code: `<?php
					$m = new Memcached();
					echo ($m instanceof Memcached) ? 'SUCCESS' : 'FAILED';
				?>`,
			});
			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('has expected methods available', async () => {
			const result = await php.run({
				code: `<?php
					$methods = [
						'addServer', 'addServers', 'getServerList',
						'get', 'set', 'add', 'replace', 'delete',
						'getMulti', 'setMulti', 'deleteMulti',
						'increment', 'decrement',
						'flush', 'getStats', 'getVersion',
						'setOption', 'getOption',
						'getResultCode', 'getResultMessage'
					];
					$m = new Memcached();
					$missing = [];
					foreach ($methods as $method) {
						if (!method_exists($m, $method)) {
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
						'Memcached::RES_SUCCESS',
						'Memcached::RES_NOTFOUND',
						'Memcached::RES_NOTSTORED',
						'Memcached::OPT_BINARY_PROTOCOL',
						'Memcached::OPT_CONNECT_TIMEOUT',
						'Memcached::OPT_SEND_TIMEOUT',
						'Memcached::OPT_RECV_TIMEOUT'
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

/**
 * PHP helper function that creates a configured memcached instance with proper
 * timeout settings for WebSocket-based TCP connections.
 */
const createMemcachedPHP = (useBinaryProtocol = false) => `
	function createMemcached() {
		$m = new Memcached();
		// Set timeouts to give WebSocket proxy time to connect
		$m->setOption(Memcached::OPT_CONNECT_TIMEOUT, 5000);
		$m->setOption(Memcached::OPT_SEND_TIMEOUT, 5000);
		$m->setOption(Memcached::OPT_RECV_TIMEOUT, 5000);
		// Blocking mode for more reliable connections in WASM
		$m->setOption(Memcached::OPT_NO_BLOCK, false);
		${useBinaryProtocol ? "$m->setOption(Memcached::OPT_BINARY_PROTOCOL, true);" : ''}
		$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});
		return $m;
	}
`;

describe('Memcached Network Integration', () => {
	beforeAll(() => {
		if (!MEMCACHED_HOST) {
			throw new Error(
				'MEMCACHED_HOST environment variable is required to run memcached network tests. ' +
				'Start a memcached server with: docker run -d -p 11211:11211 memcached:1.6-alpine ' +
				'Then run: MEMCACHED_HOST=127.0.0.1 npx vitest run php-memcached'
			);
		}
	});

	describe.each(phpVersions)('PHP %s', (phpVersion) => {
		let php: PHP;

		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withMemcached: true })
			);
		});

		afterEach(() => {
			php?.exit();
		});

		it('can connect to memcached server', async () => {
			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					// getVersion() returns an array of server versions if connected
					$versions = $m->getVersion();

					if ($versions === false) {
						echo 'CONNECT_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					echo 'CONNECTED';
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
					${createMemcachedPHP()}
					$m = createMemcached();

					$key = '${testKey}';
					$value = '${testValue}';

					// Set the value
					$setResult = $m->set($key, $value);
					if (!$setResult) {
						echo 'SET_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					// Get the value back
					$retrieved = $m->get($key);
					if ($retrieved === false && $m->getResultCode() !== Memcached::RES_SUCCESS) {
						echo 'GET_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					// Clean up
					$m->delete($key);

					echo $retrieved;
				?>`,
			});

			expect(result.text).toBe(testValue);
			expect(result.errors).toBeFalsy();
		});

		it('can set values with expiration', async () => {
			const testKey = `test_expiry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$key = '${testKey}';

					// Set with 1 hour expiration
					$m->set($key, 'test_value', 3600);

					// Verify it's there
					$value = $m->get($key);

					// Clean up
					$m->delete($key);

					echo $value !== false ? 'SUCCESS' : 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('can delete values', async () => {
			const testKey = `test_delete_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$key = '${testKey}';

					// Set a value
					$m->set($key, 'to_be_deleted');

					// Delete it
					$deleteResult = $m->delete($key);

					// Try to get it (should fail)
					$value = $m->get($key);
					$notFound = ($m->getResultCode() === Memcached::RES_NOTFOUND);

					echo ($deleteResult && $notFound) ? 'SUCCESS' : 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('can increment and decrement values', async () => {
			const testKey = `test_incr_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP(true)}
					$m = createMemcached();

					$key = '${testKey}';

					// Use increment with initial value (third parameter)
					// When key doesn't exist, it's set to initial_value (not initial + offset)
					$afterIncr = $m->increment($key, 5, 10); // key doesn't exist, so set to 10
					if ($afterIncr === false) {
						echo 'INCREMENT_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					// Decrement by 3 (10 - 3 = 7)
					$afterDecr = $m->decrement($key, 3);
					if ($afterDecr === false) {
						echo 'DECREMENT_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					// Clean up
					$m->delete($key);

					// When key doesn't exist: set to initial=10, then decrement by 3 = 7
					echo "incr:$afterIncr,decr:$afterDecr";
				?>`,
			});

			expect(result.text).toBe('incr:10,decr:7');
			expect(result.errors).toBeFalsy();
		});

		it('can handle multiple keys with getMulti/setMulti', async () => {
			const prefix = `test_multi_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$prefix = '${prefix}';
					$items = [
						$prefix . '_key1' => 'value1',
						$prefix . '_key2' => 'value2',
						$prefix . '_key3' => 'value3',
					];

					// Set multiple values
					$m->setMulti($items);

					// Get multiple values
					$keys = array_keys($items);
					$retrieved = $m->getMulti($keys);

					// Clean up
					foreach ($keys as $key) {
						$m->delete($key);
					}

					// Verify all values match
					$allMatch = true;
					foreach ($items as $key => $expectedValue) {
						if (!isset($retrieved[$key]) || $retrieved[$key] !== $expectedValue) {
							$allMatch = false;
							break;
						}
					}

					echo $allMatch ? 'SUCCESS' : 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('can store and retrieve complex data types', async () => {
			const testKey = `test_complex_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$key = '${testKey}';

					// Test storing an array
					$data = [
						'string' => 'hello',
						'number' => 42,
						'float' => 3.14,
						'bool' => true,
						'nested' => ['a' => 1, 'b' => 2],
					];

					$setResult = $m->set($key, $data);
					if (!$setResult) {
						echo 'SET_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					$retrieved = $m->get($key);

					// Clean up
					$m->delete($key);

					// Check if get succeeded
					if (!is_array($retrieved)) {
						echo 'GET_FAILED: expected array, got ' . gettype($retrieved) . ' - ' . $m->getResultMessage();
						exit(1);
					}

					// Verify the data is intact
					$isValid = (
						$retrieved['string'] === 'hello' &&
						$retrieved['number'] === 42 &&
						$retrieved['float'] === 3.14 &&
						$retrieved['bool'] === true &&
						$retrieved['nested']['a'] === 1 &&
						$retrieved['nested']['b'] === 2
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
					${createMemcachedPHP()}
					$m = createMemcached();

					$value = $m->get('definitely_does_not_exist_' . uniqid());
					$resultCode = $m->getResultCode();

					echo ($value === false && $resultCode === Memcached::RES_NOTFOUND)
						? 'SUCCESS'
						: 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('can use add() to only set if key does not exist', async () => {
			const testKey = `test_add_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$key = '${testKey}';

					// First add should succeed
					$first = $m->add($key, 'first_value');

					// Second add should fail (key exists)
					$second = $m->add($key, 'second_value');

					// Value should still be 'first_value'
					$value = $m->get($key);

					// Clean up
					$m->delete($key);

					echo ($first && !$second && $value === 'first_value')
						? 'SUCCESS'
						: 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('can use replace() to only set if key exists', async () => {
			const testKey = `test_replace_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$key = '${testKey}';

					// Replace on non-existent key should fail
					$firstReplace = $m->replace($key, 'first_value');

					// Set the key
					$m->set($key, 'original_value');

					// Replace should now succeed
					$secondReplace = $m->replace($key, 'replaced_value');

					// Value should be 'replaced_value'
					$value = $m->get($key);

					// Clean up
					$m->delete($key);

					echo (!$firstReplace && $secondReplace && $value === 'replaced_value')
						? 'SUCCESS'
						: 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});

		it('can flush all keys', async () => {
			const prefix = `test_flush_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					${createMemcachedPHP()}
					$m = createMemcached();

					$prefix = '${prefix}';

					// Set some test keys
					$m->set($prefix . '_1', 'value1');
					$m->set($prefix . '_2', 'value2');

					// Flush all keys
					$flushResult = $m->flush();

					// Note: flush() may have a delay, so we just check the return value
					echo $flushResult ? 'SUCCESS' : 'FAILED';
				?>`,
			});

			expect(result.text).toBe('SUCCESS');
			expect(result.errors).toBeFalsy();
		});
	});
});
