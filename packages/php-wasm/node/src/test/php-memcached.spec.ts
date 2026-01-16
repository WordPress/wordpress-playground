/**
 * Memcached integration tests.
 *
 * These tests require a running memcached server. They are skipped if the
 * MEMCACHED_HOST environment variable is not set.
 *
 * To run locally:
 *   docker run -d -p 11211:11211 memcached:1.6-alpine
 *   MEMCACHED_HOST=127.0.0.1 npx vitest run php-memcached
 */

import { PHP, SupportedPHPVersions, type SupportedPHPVersion } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const MEMCACHED_HOST = process.env['MEMCACHED_HOST'];
const MEMCACHED_PORT = process.env['MEMCACHED_PORT'] || '11211';

const phpVersions =
	'PHP' in process.env
		? [process.env['PHP']! as SupportedPHPVersion]
		: SupportedPHPVersions;

const describeIfMemcached = MEMCACHED_HOST ? describe : describe.skip;

describeIfMemcached('Memcached Integration', () => {
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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});
					// Use binary protocol for increment/decrement to work properly
					$m->setOption(Memcached::OPT_BINARY_PROTOCOL, true);

					$key = '${testKey}';

					// Use increment with initial value (third and fourth parameters)
					// This atomically sets the key if it doesn't exist
					$afterIncr = $m->increment($key, 5, 10); // initial=10, then +5 = 15
					if ($afterIncr === false) {
						echo 'INCREMENT_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					// Decrement by 3
					$afterDecr = $m->decrement($key, 3);
					if ($afterDecr === false) {
						echo 'DECREMENT_FAILED: ' . $m->getResultMessage();
						exit(1);
					}

					// Clean up
					$m->delete($key);

					// Should be 10 + 5 = 15, then 15 - 3 = 12
					echo "incr:$afterIncr,decr:$afterDecr";
				?>`,
			});

			expect(result.text).toBe('incr:15,decr:12');
			expect(result.errors).toBeFalsy();
		});

		it('can handle multiple keys with getMulti/setMulti', async () => {
			const prefix = `test_multi_${Date.now()}_${Math.random().toString(36).substring(7)}`;

			const result = await php.run({
				code: `<?php
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
					$m = new Memcached();
					$m->addServer('${MEMCACHED_HOST}', ${MEMCACHED_PORT});

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
