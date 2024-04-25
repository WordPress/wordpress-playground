import { createSpawnHandler, ProcessApi } from './create-spawn-handler';

describe('createSpawnHandler', () => {
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
});
