import type { ProcessApi } from '../lib/create-spawn-handler';
import { createSpawnHandler } from '../lib/create-spawn-handler';

describe('createSpawnHandler', () => {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	it('should create and execute a spawn handler', async () => {
		const command = 'testCommand';
		const testOut = 'testOut';
		const testErr = 'testErr';

		const program = vitest.fn((cmd: string[], processApi: ProcessApi) => {
			expect(cmd).toEqual([command]);
			processApi.stdout(testOut);
			processApi.stderr(testErr);
			processApi.exit(0);
		});

		const spawnHandler = createSpawnHandler(program);
		const childProcess = spawnHandler(command);

		return new Promise((done) => {
			childProcess.stdout.on('data', (data: ArrayBuffer) => {
				const decodedData = new TextDecoder().decode(data);
				expect(decodedData).toBe(testOut);
				done(null);
			});

			childProcess.stderr.on('data', (data: ArrayBuffer) => {
				const decodedData = new TextDecoder().decode(data);
				expect(decodedData).toBe(testErr);
				done(null);
			});

			childProcess.on('exit', (code: number) => {
				expect(code).toBe(0);
				expect(program).toHaveBeenCalled();
			});
		});
	});

	it('should exit with code 1 when the spawned process throws an exception', async () => {
		const command = 'testCommand';
		const program = vitest.fn(() => {
			throw new Error('Program crash');
		});

		const spawnHandler = createSpawnHandler(program);
		const childProcess = spawnHandler(command);

		const errorfn = vitest.fn();
		await new Promise((done) => {
			childProcess.on('error', errorfn);
			childProcess.on('exit', (code: number) => {
				expect(code).toBe(1);
				expect(program).toHaveBeenCalled();
				done(null);
			});
		});
		expect(errorfn).toHaveBeenCalledWith(new Error('Program crash'));
	});

	it('reads all stdin bytes', async () => {
		const program = vitest.fn(
			async (_cmd: string[], processApi: ProcessApi) => {
				const stdin = await processApi.readStdin();
				processApi.stdout(decoder.decode(stdin.bytes));
				processApi.exit(0);
			}
		);

		const spawnHandler = createSpawnHandler(program);
		const childProcess = spawnHandler('testCommand');
		const stdout: string[] = [];
		childProcess.stdin.write(encoder.encode('first '));
		childProcess.stdin.write(encoder.encode('second'));
		childProcess.stdin.end();

		const exitCode = await new Promise<number>((resolve) => {
			childProcess.stdout.on('data', (data: ArrayBuffer) => {
				stdout.push(decoder.decode(data));
			});
			childProcess.on('exit', resolve);
		});

		expect(exitCode).toBe(0);
		expect(stdout.join('')).toBe('first second');
	});

	it('drains stdin and reports when maxSize is exceeded', async () => {
		const program = vitest.fn(
			async (_cmd: string[], processApi: ProcessApi) => {
				const stdin = await processApi.readStdin({ maxSize: 5 });
				expect(stdin.exceededMaxSize).toBe(true);
				expect(stdin.bytes.length).toBe(0);
				processApi.exit(1);
			}
		);

		const spawnHandler = createSpawnHandler(program);
		const childProcess = spawnHandler('testCommand');
		childProcess.stdin.write(encoder.encode('123456'));
		childProcess.stdin.end();

		const exitCode = await new Promise<number>((resolve) => {
			childProcess.on('exit', resolve);
		});

		expect(exitCode).toBe(1);
	});
});
