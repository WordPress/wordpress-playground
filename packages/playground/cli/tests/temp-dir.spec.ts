import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { join } from 'path';
import {
	createPlaygroundCliTempDir,
	cleanupStalePlaygroundTempDirs,
} from '../src/temp-dir';

describe('temp-dir', () => {
	const substrToIdentifyTempDirs = '-test-playground-cli-temp-dir-';

	let childProcess: ReturnType<typeof fork>;

	beforeEach(() => {
		const tempDirTestProcessPath = join(
			__dirname,
			'temp-dir-test-process.ts'
		);
		childProcess = fork(tempDirTestProcessPath);
	});

	afterEach(async () => {
		if (childProcess.exitCode === null) {
			// The process is still running.
			await new Promise((resolve) => {
				childProcess.send({ type: 'exit' });
				childProcess.on('exit', resolve);
			});
		}
	});

	it('should create a temp dir', async () => {
		childProcess.send({ type: 'create-temp-dir' });
		const tempDir = await createPlaygroundCliTempDir(
			substrToIdentifyTempDirs
		);
		expect(fs.lstatSync(tempDir).isDirectory()).toBe(true);
	});
	it('should clean up a temp dir before exiting', async () => {
		childProcess.send({
			type: 'create-temp-dir',
			substrToIdentifyTempDirs,
		});
		const tempDir = await new Promise<string>((resolve, reject) => {
			childProcess.once('message', (message: any) => {
				if (message.type === 'temp-dir') {
					resolve(message.tempDir);
				} else {
					reject(new Error('Unexpected message'));
				}
			});
		});
		expect(fs.lstatSync(tempDir).isDirectory()).toBe(true);
		childProcess.send({ type: 'exit' });
		await new Promise((resolve) => {
			childProcess.on('exit', resolve);
		});
		expect(fs.existsSync(tempDir)).toBe(false);
	});
	it('should clean up stale temp dirs', async () => {
		const tempDirs = [];
		for (let i = 0; i < 10; i++) {
			childProcess.send({
				type: 'create-temp-dir',
				substrToIdentifyTempDirs,
				// Disable auto-cleanup so we can test stale dir cleanup.
				autoCleanup: false,
			});
			const tempDir = await new Promise<string>((resolve, reject) => {
				childProcess.once('message', (message: any) => {
					if (message.type === 'temp-dir') {
						resolve(message.tempDir);
					} else {
						reject(new Error('Unexpected message'));
					}
				});
			});
			tempDirs.push(tempDir);
		}

		for (const tempDir of tempDirs) {
			expect(fs.lstatSync(tempDir).isDirectory()).toBe(true);
		}
		childProcess.send({ type: 'exit' });
		await new Promise((resolve) => {
			childProcess.on('exit', resolve);
		});

		// NOTE: This is a short expiration time for testing purposes.
		// In practice, we may wait hours or days before considering a
		// temp dir stale.
		const staleAgeInMillis = 1000;
		await new Promise((resolve) => {
			// Wait until the temp dirs can be considered stale.
			setTimeout(resolve, staleAgeInMillis);
		});

		// Infer temp dir root from the first temp dir.
		const tempDirRoot = path.dirname(tempDirs[0]);
		await cleanupStalePlaygroundTempDirs(
			substrToIdentifyTempDirs,
			staleAgeInMillis,
			tempDirRoot
		);

		for (const tempDir of tempDirs) {
			expect(fs.existsSync(tempDir)).toBe(false);
		}
	});
	it('should not clean up stale temp dir if the process is still running', async () => {
		childProcess.send({
			type: 'create-temp-dir',
			substrToIdentifyTempDirs,
			// Disable auto-cleanup so we can test stale dir cleanup.
			autoCleanup: false,
		});
		const tempDir = await new Promise<string>((resolve, reject) => {
			childProcess.once('message', (message: any) => {
				if (message.type === 'temp-dir') {
					resolve(message.tempDir);
				} else {
					reject(new Error('Unexpected message'));
				}
			});
		});
		expect(fs.lstatSync(tempDir).isDirectory()).toBe(true);

		// NOTE: This is a short expiration time for testing purposes.
		// In practice, we may wait hours or days before considering a
		// temp dir stale.
		const staleAgeInMillis = 1000;
		await new Promise((resolve) => {
			// Wait until the temp dirs can be considered stale.
			setTimeout(resolve, staleAgeInMillis);
		});

		expect(childProcess.exitCode).toBe(null);
		await cleanupStalePlaygroundTempDirs(
			substrToIdentifyTempDirs,
			staleAgeInMillis,
			path.dirname(tempDir)
		);
		// Temp dir should not be cleaned up while the associated process was still running.
		expect(fs.existsSync(tempDir)).toBe(true);

		childProcess.send({ type: 'exit' });
		await new Promise((resolve) => {
			childProcess.on('exit', resolve);
		});
		expect(childProcess.exitCode).toBe(0);

		await cleanupStalePlaygroundTempDirs(
			substrToIdentifyTempDirs,
			staleAgeInMillis,
			path.dirname(tempDir)
		);
		// Temp dir was cleaned up when the associated process no longer exists.
		expect(fs.existsSync(tempDir)).toBe(false);
	});
});
