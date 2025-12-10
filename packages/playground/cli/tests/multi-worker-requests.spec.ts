/**
 * Tests for multi-worker concurrent request handling.
 *
 * This test suite verifies that when Playground CLI is configured with multiple
 * workers, concurrent HTTP requests are distributed across different workers.
 * Each worker runs in its own process with a unique PID, allowing us to confirm
 * that load balancing is functioning correctly.
 */
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCLI, internalsKeyForTesting } from '../src/run-cli';
import type { RunCLIServer } from '../src/run-cli';

const TEST_SUITE_PREP_TIMEOUT = 120_000;
const TEST_SUITE_CLEANUP_TIMEOUT = 120_000;
const TEST_CASE_TIMEOUT = 60_000;
const TEST_DIR = '/wordpress/test';
const TEST_DIR_URI = '/test';
const MULTI_WORKER_COUNT = 4;

describe('Playground CLI multi-worker concurrent requests', () => {
	let cliServer: RunCLIServer;
	let nativeTestDir: string;

	beforeAll(async () => {
		nativeTestDir = mkdtempSync(
			path.join(os.tmpdir(), 'playground-cli-multi-worker-test-')
		);

		cliServer = await runCLI({
			command: 'server',
			mount: [
				{
					hostPath: nativeTestDir,
					vfsPath: TEST_DIR,
				},
			],
			experimentalMultiWorker: MULTI_WORKER_COUNT,
		});
	}, TEST_SUITE_PREP_TIMEOUT);

	afterAll(async () => {
		if (cliServer) {
			await cliServer[Symbol.asyncDispose]();
		}
	}, TEST_SUITE_CLEANUP_TIMEOUT);

	function writeScript(script: string, content: string): Promise<void> {
		return cliServer.playground.writeFile(`${TEST_DIR}/${script}`, content);
	}

	function fetchScript(script: string): Promise<Response> {
		return fetch(new URL(`${TEST_DIR_URI}/${script}`, cliServer.serverUrl));
	}

	/**
	 * Asserts that a set of process IDs come from different workers.
	 * Uses the internals helper to map PIDs to worker numbers and ensures
	 * each PID maps to a unique worker.
	 */
	function assertProcessIdsFromDifferentWorkers(...pids: number[]) {
		for (const pid of pids) {
			expect(pid).toBeTypeOf('number');
			expect(pid).toBeGreaterThan(0);
		}
		const workerNumbers = pids.map(
			cliServer[internalsKeyForTesting].getWorkerNumberFromProcessId
		);
		for (const workerNumber of workerNumbers) {
			// +1 to account for the initial worker.
			expect(workerNumber).toBeLessThan(MULTI_WORKER_COUNT + 1);
		}
		expect(new Set(workerNumbers).size).toBe(workerNumbers.length);
	}

	describe(
		'concurrent requests are handled by multiple workers',
		() => {
			it('distributes concurrent requests across different workers', async () => {
				// Create multiple PHP scripts that each sleep briefly and return their PID.
				// The sleep ensures requests overlap in time, forcing the load balancer
				// to distribute them across workers rather than reusing a single worker.
				const scriptNames: string[] = [];
				for (let i = 0; i < MULTI_WORKER_COUNT; i++) {
					const scriptName = `worker-test-${i}.php`;
					scriptNames.push(scriptName);
					await writeScript(
						scriptName,
						`<?php
// Sleep briefly to ensure all requests overlap
usleep(200 * 1000);
header('X-Worker-PID: ' . getmypid());
echo json_encode([
	'pid' => getmypid(),
	'worker' => ${i},
]);
`
					);
				}

				// Send all requests concurrently
				const responses = await Promise.all(
					scriptNames.map((script) => fetchScript(script))
				);

				// Verify all requests succeeded
				for (const response of responses) {
					expect(response.status).toBe(200);
				}

				// Parse responses and extract PIDs
				const outputs = await Promise.all(
					responses.map((r) => r.json())
				);
				const pids = outputs.map((output) => output.pid);

				// Verify that requests were handled by different workers
				assertProcessIdsFromDifferentWorkers(...pids);

				// Also verify the X-Worker-PID header was set correctly
				for (let i = 0; i < responses.length; i++) {
					const headerPid = responses[i].headers.get('X-Worker-PID');
					expect(headerPid).toBe(String(outputs[i].pid));
				}
			});

			it('handles a burst of concurrent requests larger than worker count', async () => {
				// Send more requests than workers to verify the load balancer
				// handles the overflow correctly by queueing or distributing
				const requestCount = MULTI_WORKER_COUNT * 2;
				const scriptNames: string[] = [];

				for (let i = 0; i < requestCount; i++) {
					const scriptName = `burst-test-${i}.php`;
					scriptNames.push(scriptName);
					await writeScript(
						scriptName,
						`<?php
usleep(100 * 1000);
header('X-Worker-PID: ' . getmypid());
echo json_encode([
	'pid' => getmypid(),
	'request' => ${i},
]);
`
					);
				}

				const responses = await Promise.all(
					scriptNames.map((script) => fetchScript(script))
				);

				for (const response of responses) {
					expect(response.status).toBe(200);
				}

				const outputs = await Promise.all(
					responses.map((r) => r.json())
				);
				const pids = outputs.map((output) => output.pid);

				// With more requests than workers, we expect to see multiple
				// distinct worker PIDs used (at least half the worker count)
				const uniqueWorkerNumbers = new Set(
					pids.map(
						cliServer[internalsKeyForTesting]
							.getWorkerNumberFromProcessId
					)
				);

				// Should use at least half the available workers
				expect(uniqueWorkerNumbers.size).toBeGreaterThanOrEqual(
					Math.ceil(MULTI_WORKER_COUNT / 2)
				);
			});

			it('maintains separate PHP state across concurrent requests', async () => {
				// This test verifies that each worker maintains isolated state
				// by setting a global variable in one request and verifying
				// another concurrent request doesn't see it
				const coordinationFile = `${TEST_DIR}/coordination-state.txt`;
				await cliServer.playground.writeFile(
					coordinationFile,
					'initial'
				);

				const script1 = 'state-setter.php';
				await writeScript(
					script1,
					`<?php
// Set a global variable
$GLOBALS['test_value'] = 'set_by_script1';

// Signal that we've set the value
file_put_contents('${coordinationFile}', 'value-set');

// Wait for script2 to check
while (file_get_contents('${coordinationFile}') !== 'checked') {
	usleep(50 * 1000);
}

echo json_encode([
	'pid' => getmypid(),
	'test_value' => $GLOBALS['test_value'] ?? null,
]);
`
				);

				const script2 = 'state-checker.php';
				await writeScript(
					script2,
					`<?php
// Wait for script1 to set its value
while (file_get_contents('${coordinationFile}') !== 'value-set') {
	usleep(50 * 1000);
}

// Check if we can see the global variable (we shouldn't - different process)
$value = $GLOBALS['test_value'] ?? null;

// Signal that we've checked
file_put_contents('${coordinationFile}', 'checked');

echo json_encode([
	'pid' => getmypid(),
	'test_value' => $value,
]);
`
				);

				const [response1, response2] = await Promise.all([
					fetchScript(script1),
					fetchScript(script2),
				]);

				expect(response1.status).toBe(200);
				expect(response2.status).toBe(200);

				const output1 = await response1.json();
				const output2 = await response2.json();

				// Verify they ran on different workers
				assertProcessIdsFromDifferentWorkers(output1.pid, output2.pid);

				// Script1 should see its own value
				expect(output1.test_value).toBe('set_by_script1');

				// Script2 should NOT see script1's global (isolated processes)
				expect(output2.test_value).toBeNull();
			});
		},
		TEST_CASE_TIMEOUT
	);
});
