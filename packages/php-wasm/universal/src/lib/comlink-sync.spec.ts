import { describe, it, expect } from 'vitest';
import { MessageChannel, Worker as NodeWorker } from 'worker_threads';
import { NodeSABSyncReceiveMessageTransport } from './comlink-sync';

// Node.js < 23 does not support TypeScript and won't run this test.
const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);

describe.skipIf(nodeVersion < 23)('Comlink Sync Communication Tests', () => {
	describe('Basic Infrastructure', () => {
		it('should create transport successfully', async () => {
			const transport = await NodeSABSyncReceiveMessageTransport.create();
			expect(transport).toBeDefined();
			expect(typeof transport.send).toBe('function');
			expect(typeof transport.afterResponseSent).toBe('function');
		});
	});

	describe('Real Multi-Worker Synchronous Communication', () => {
		async function createInlineWorker(
			workerCode: string
		): Promise<NodeWorker> {
			// Create a worker from inline code to avoid import path issues
			const worker = new NodeWorker(workerCode, {
				eval: true,
				stdout: true,
				stderr: true,
			});
			worker.stdout.on('data', (data) => {
				console.log('worker stdout', new TextDecoder().decode(data));
			});
			worker.stderr.on('data', (data) => {
				console.log('worker stderr', new TextDecoder().decode(data));
			});

			// Wait for worker to load
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('Worker load timeout')),
					5000
				);
				worker.once('message', (data) => {
					if (data.type === 'loaded') {
						clearTimeout(timeout);
						resolve();
					}
				});
				// Reject if worker exits prematurely or errors
				worker.on('error', (error) => {
					clearTimeout(timeout);
					reject(new Error(`Worker error: ${error.message}`));
				});

				worker.on('exit', (code) => {
					if (code !== 0) {
						clearTimeout(timeout);
						reject(new Error(`Worker exited with code ${code}`));
					}
				});
			});

			return worker;
		}

		async function setupWorkerWithPort(
			worker: NodeWorker,
			port: MessageChannel['port1']
		): Promise<void> {
			worker.postMessage({ type: 'setup', port }, [port]);

			// Wait for worker to be ready
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('Worker setup timeout')),
					5000
				);
				worker.once('message', (data) => {
					if (data.type === 'ready') {
						clearTimeout(timeout);
						resolve();
					} else if (data.type === 'error') {
						clearTimeout(timeout);
						reject(new Error(data.message));
					}
				});
			});
		}

		const comlinkSyncPath = import.meta.dirname + '/comlink-sync.ts';
		// Simple inline worker code that doesn't depend on complex imports
		const serverWorkerCode = `
			import { parentPort } from 'worker_threads';
			import { exposeSync, NodeSABSyncReceiveMessageTransport } from "${comlinkSyncPath}";
			export {};
			
			const testAPI = {
				ping: () => 'pong',
				add: (a, b) => a + b,
				multiply: (a, b) => a * b,
				getCurrentTime: () => Date.now(),
				processArray: (numbers) => numbers.reduce((sum, num) => sum + num, 0),
				throwError: () => { throw new Error('Test error from sync API server'); }
			};
			
			parentPort?.on('message', async (data) => {
				if (data.type === 'setup' && data.port) {
					const transport = await NodeSABSyncReceiveMessageTransport.create();
					await exposeSync(testAPI, data.port, transport);
					parentPort?.postMessage({ type: 'ready' });
				}
			});
			parentPort?.postMessage({ type: 'loaded' });
		`;

		const clientWorkerCode = `
			import { parentPort } from 'worker_threads';
			import { wrapSync, NodeSABSyncReceiveMessageTransport } from "${comlinkSyncPath}";
			
			let syncAPI = null;
			parentPort?.on('message', async (data) => {
				if (data.type === 'setup' && data.port) {
					const transport = await NodeSABSyncReceiveMessageTransport.create();
					syncAPI = await wrapSync(data.port, transport);
					parentPort?.postMessage({ type: 'ready' });
				} else if (data.type === 'test' && syncAPI) {
					try {
						const testName = data.testName;
						let result;
						
						switch (testName) {
							case 'ping':
								result = await syncAPI.ping();
								break;
							case 'add':
								result = await syncAPI.add(5, 10);
								break;
							case 'multiply':
								result = await syncAPI.multiply(3, 7);
								break;
							case 'getCurrentTime':
								result = await syncAPI.getCurrentTime();
								break;
							case 'processArray':
								result = await syncAPI.processArray([1, 2, 3, 4, 5]);
								break;
							case 'throwError':
								try {
									await syncAPI.throwError();
									result = 'ERROR: Should have thrown';
								} catch (error) {
									result = 'Caught error: ' + error.message;
								}
								break;
							default:
								result = 'Unknown test: ' + testName;
						}
						
						parentPort?.postMessage({ 
							type: 'test-result', 
							testName,
							result,
							success: true
						});
					} catch (error) {
						parentPort?.postMessage({ 
							type: 'test-result', 
							testName: data.testName,
							result: error.message,
							success: false
						});
					}
				}
			});
			
			parentPort?.postMessage({ type: 'loaded' });
		`;

		it('should enable synchronous method calls between workers', async () => {
			// Create message channel for worker communication
			const { port1, port2 } = new MessageChannel();

			// Create server worker (exposes sync API)
			const serverWorker = await createInlineWorker(serverWorkerCode);

			// Create client worker (consumes sync API)
			const clientWorker = await createInlineWorker(clientWorkerCode);

			try {
				// Set up workers with their respective ports
				await Promise.all([
					setupWorkerWithPort(serverWorker, port1),
					setupWorkerWithPort(clientWorker, port2),
				]);

				// Test synchronous method calls
				const testCases = [
					{ testName: 'ping', expected: 'pong' },
					{ testName: 'add', expected: 15 },
					{ testName: 'multiply', expected: 21 },
					{ testName: 'processArray', expected: 15 },
				];

				for (const testCase of testCases) {
					// Send test request to client worker
					clientWorker.postMessage({
						type: 'test',
						testName: testCase.testName,
					});

					// Wait for result
					const result = await new Promise<any>((resolve, reject) => {
						const timeout = setTimeout(
							() =>
								reject(
									new Error(
										`Test ${testCase.testName} timeout`
									)
								),
							10000
						);
						clientWorker.once('message', (data: any) => {
							if (
								data.type === 'test-result' &&
								data.testName === testCase.testName
							) {
								clearTimeout(timeout);
								resolve(data);
							}
						});
					});

					expect(result.success).toBe(true);
					expect(result.result).toBe(testCase.expected);
				}
			} finally {
				await serverWorker.terminate();
				await clientWorker.terminate();
			}
		});

		it('should handle errors in synchronous calls', async () => {
			// Create message channel for worker communication
			const { port1, port2 } = new MessageChannel();

			// Create server worker (exposes sync API)
			const serverWorker = await createInlineWorker(serverWorkerCode);

			// Create client worker (consumes sync API)
			const clientWorker = await createInlineWorker(clientWorkerCode);

			try {
				// Set up workers with their respective ports
				await Promise.all([
					setupWorkerWithPort(serverWorker, port1),
					setupWorkerWithPort(clientWorker, port2),
				]);

				// Test error handling
				clientWorker.postMessage({
					type: 'test',
					testName: 'throwError',
				});

				// Wait for result
				const result = await new Promise<any>((resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error('Error test timeout')),
						10000
					);
					clientWorker.once('message', (data) => {
						if (
							data.type === 'test-result' &&
							data.testName === 'throwError'
						) {
							clearTimeout(timeout);
							resolve(data);
						}
					});
				});

				expect(result.success).toBe(true);
				expect(result.result).toContain(
					'Test error from sync API server'
				);
			} finally {
				await serverWorker.terminate();
				await clientWorker.terminate();
			}
		});

		it('should demonstrate time-based synchronous calls', async () => {
			// Create message channel for worker communication
			const { port1, port2 } = new MessageChannel();

			// Create server worker (exposes sync API)
			const serverWorker = await createInlineWorker(serverWorkerCode);

			// Create client worker (consumes sync API)
			const clientWorker = await createInlineWorker(clientWorkerCode);

			try {
				// Set up workers with their respective ports
				await Promise.all([
					setupWorkerWithPort(serverWorker, port1),
					setupWorkerWithPort(clientWorker, port2),
				]);

				// Record start time
				const startTime = Date.now();

				// Test getCurrentTime call
				clientWorker.postMessage({
					type: 'test',
					testName: 'getCurrentTime',
				});

				// Wait for result
				const result = await new Promise<any>((resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error('Time test timeout')),
						10000
					);
					clientWorker.once('message', (data: any) => {
						if (
							data.type === 'test-result' &&
							data.testName === 'getCurrentTime'
						) {
							clearTimeout(timeout);
							resolve(data);
						}
					});
				});

				const endTime = Date.now();

				expect(result.success).toBe(true);
				expect(typeof result.result).toBe('number');

				// Verify the time returned is reasonable (between start and end)
				expect(result.result).toBeGreaterThanOrEqual(startTime);
				expect(result.result).toBeLessThanOrEqual(endTime);
			} finally {
				await serverWorker.terminate();
				await clientWorker.terminate();
			}
		});
	});
});
