import fs from 'fs';
import path from 'path';
import { logger } from '@php-wasm/logger';
import {
	dir as tmpDir,
	setGracefulCleanup as tmpSetGracefulCleanup,
} from 'tmp-promise';

/**
 * Create a temp dir for the Playground CLI.
 *
 * The temp dir is created in the system temp dir and is named
 * based on the Playground CLI binary name and the process ID.
 *
 * @param substrToIdentifyTempDirs The substring to identify the temp dir.
 * @param autoCleanup Whether to skip cleanup on process exit. Primarily used for unit testing.
 * @returns The path to the temp dir.
 */
export async function createPlaygroundCliTempDir(
	substrToIdentifyTempDirs: string,
	// Allow controlling auto-cleanup for test purposes.
	autoCleanup = true
) {
	const nodeBinaryName = path.basename(process.argv0);

	// We place the binary name before the playground-related fragment
	// so we can use the position of the fragment to parse the binary name.
	// Otherwise, we would have to parse the binary name from the full path.
	const tempDirPrefix = `${nodeBinaryName}${substrToIdentifyTempDirs}${process.pid}-`;

	const nativeDir = await tmpDir({
		prefix: tempDirPrefix,
		/*
		 * Allow recursive cleanup on process exit.
		 *
		 * NOTE: I worried about whether this cleanup would follow symlinks
		 * and delete target files instead of unlinking the symlink,
		 * but this feature uses rimraf under the hood which respects symlinks:
		 * https://github.com/raszi/node-tmp/blob/3d2fe387f3f91b13830b9182faa02c3231ea8258/lib/tmp.js#L318
		 */
		unsafeCleanup: true,
	});

	if (autoCleanup) {
		// Request graceful cleanup on process exit.
		tmpSetGracefulCleanup();
	}

	return nativeDir;
}

/**
 * Cleanup stale Playground temp dirs.
 *
 * A temp dir is considered stale if it is older than the specified age
 * and the associated process no longer exists.
 *
 * @param substrToIdentifyTempDirs The substring to identify the temp dir.
 * @param staleAgeInMillis The age in milliseconds after which a temp dir is considered stale.
 * @param tempRootDir The root directory of the temp dirs.
 */
export async function cleanupStalePlaygroundTempDirs(
	substrToIdentifyTempDirs: string,
	staleAgeInMillis: number,
	tempRootDir: string
) {
	const stalePlaygroundTempDirs = await findStalePlaygroundTempDirs(
		substrToIdentifyTempDirs,
		staleAgeInMillis,
		tempRootDir
	);
	const promisesToRemove = stalePlaygroundTempDirs.map(
		(stalePlaygroundTempDir) =>
			new Promise<void>((resolve) => {
				// TODO: Non-blocking: Consider how to avoid conflicts with another CLI doing cleanup.
				fs.rm(stalePlaygroundTempDir, { recursive: true }, (err) => {
					if (err) {
						logger.warn(
							`Failed to delete stale Playground temp dir: ${stalePlaygroundTempDir}`,
							err
						);
					} else {
						logger.info(
							`Deleted stale Playground temp dir: ${stalePlaygroundTempDir}`
						);
					}
					resolve();
				});
			})
	);
	await Promise.all(promisesToRemove);
}

async function findStalePlaygroundTempDirs(
	substrToIdentifyTempDirs: string,
	staleAgeInMillis: number,
	tempRootDir: string
) {
	try {
		const tempPaths = fs
			.readdirSync(tempRootDir)
			.map((dirName) => path.join(tempRootDir, dirName));

		const stalePlaygroundTempDirs = [];
		for (const tempPath of tempPaths) {
			const appearsToBeStale = await appearsToBeStalePlaygroundTempDir(
				substrToIdentifyTempDirs,
				staleAgeInMillis,
				tempPath
			);
			if (appearsToBeStale) {
				stalePlaygroundTempDirs.push(tempPath);
			}
		}
		return stalePlaygroundTempDirs;
	} catch (e) {
		logger.warn(`Failed to find stale Playground temp dirs: ${e}`);
		// Failing to find stale temp dirs should not prevent the CLI from starting.
		return [];
	}
}

async function appearsToBeStalePlaygroundTempDir(
	substrToIdentifyTempDirs: string,
	staleAgeInMillis: number,
	absolutePath: string
) {
	const lstat = fs.lstatSync(absolutePath);
	if (!lstat.isDirectory()) {
		// A non-directory cannot be a Playground temp dir.
		return false;
	}

	const dirName = path.basename(absolutePath);
	if (!dirName.includes(substrToIdentifyTempDirs)) {
		// This doesn't look like one of our temp dirs.
		return false;
	}

	const match = dirName.match(
		new RegExp(`^(.+)${substrToIdentifyTempDirs}(\\d+)-`)
	);
	if (!match) {
		// We cannot parse the temp dir name,
		// so there is nothing more to try.
		return false;
	}

	const info = {
		absolutePath,
		executableName: match[1],
		pid: match[2],
	};

	if (doesProcessExist(info.pid, info.executableName)) {
		// It looks like the temp dir's process is still running.
		return false;
	}

	const STALE_DATE = Date.now() - staleAgeInMillis;
	const dirStat = fs.statSync(absolutePath);
	if (dirStat.mtime.getTime() < STALE_DATE) {
		return true;
	}

	return false;
}

function doesProcessExist(
	pid: string,
	// NOTE: We used to use the executable name as well to reduce the risk
	// of PID reuse causing false positives, but confirming process name has
	// been slow on Windows and doesn't seem to be worth the cost. The worst
	// that happens when a PID is reused by another process is that we don't
	// delete a stale temp dir.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_executableName: string
) {
	// Use process.kill with signal 0 to check if the process exists.
	// Signal 0 doesn't actually send a signal — it just checks whether
	// the process is running. This is instant on all platforms, unlike
	// the previous ps-man approach which spawned `tasklist` on Windows
	// (taking ~1 second per call).
	try {
		process.kill(Number(pid), 0);
		return true;
	} catch (error: unknown) {
		const errorWithCode = error as { code?: unknown };
		const code =
			errorWithCode && typeof errorWithCode.code === 'string'
				? errorWithCode.code
				: undefined;

		if (code === 'ESRCH') {
			// ESRCH means the process does not exist.
			return false;
		}

		if (code === 'EPERM' || code === 'EACCES') {
			// EPERM/EACCES mean the process exists but we lack permission to signal
			// it. This is expected on some systems for certain PIDs, so only log
			// at debug level to avoid noisy logs during normal operation.
			logger.debug(
				`Permission denied while checking if process ${pid} exists (code: ${code}).`,
				error
			);
			return true;
		}

		// For any other unexpected error, assume the process exists to
		// avoid accidentally deleting a temp dir that may still be in use.
		logger.warn(
			`Could not determine if process ${pid} exists due to unexpected error${
				code ? ` (code: ${code})` : ''
			}.`,
			error
		);
		return true;
	}
}
