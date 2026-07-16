import { describe, expect, it } from 'vitest';
import {
	resolveNativeTarget,
	validateNativeHostManifest,
} from '../src/manifest.js';
import { NativeCLIErrorCode } from '../src/errors.js';

describe('native host manifest', () => {
	it('maps all supported platform families', () => {
		for (const [info, expected] of [
			[
				{ platform: 'linux', arch: 'x64', glibcVersion: '2.31' },
				'linux-x64-gnu',
			],
			[
				{ platform: 'linux', arch: 'arm64', glibcVersion: '2.31' },
				'linux-arm64-gnu',
			],
			[{ platform: 'darwin', arch: 'x64' }, 'darwin-x64'],
			[{ platform: 'darwin', arch: 'arm64' }, 'darwin-arm64'],
			[{ platform: 'win32', arch: 'x64' }, 'win32-x64'],
			[{ platform: 'win32', arch: 'arm64' }, 'win32-arm64'],
		] as const) {
			expect(resolveNativeTarget(info)).toBe(expected);
		}
	});

	it('rejects musl before acquisition', () => {
		expect(() =>
			resolveNativeTarget({ platform: 'linux', arch: 'x64' })
		).toThrowError(
			expect.objectContaining({ code: NativeCLIErrorCode.Unsupported })
		);
	});

	it('requires exact sizes and hashes', () => {
		expect(() =>
			validateNativeHostManifest({
				schemaVersion: 1,
				protocolVersion: 1,
				hostVersion: 'test',
				targets: { 'linux-x64-gnu': { path: 'host.gz', size: 1 } },
			})
		).toThrow(/compressedSize/);
	});

	it.each(['.', '..'])('rejects escaping host version %s', (hostVersion) => {
		expect(() =>
			validateNativeHostManifest(validManifest({ hostVersion }))
		).toThrow(/path-safe/);
	});

	it.each([
		'../host.gz',
		'/host.gz',
		'https://example.test/host.gz',
		'hosts\\host.gz',
	])('rejects unsafe asset path %s', (path) => {
		expect(() =>
			validateNativeHostManifest(validManifest({ path }))
		).toThrow(/identify a .gz file/);
	});
});

function validManifest(overrides: { hostVersion?: string; path?: string }) {
	return {
		schemaVersion: 1,
		protocolVersion: 1,
		hostVersion: overrides.hostVersion ?? 'test',
		targets: {
			'linux-x64-gnu': {
				path: overrides.path ?? 'hosts/host.gz',
				compressedSize: 1,
				compressedSha256: '0'.repeat(64),
				size: 1,
				sha256: '1'.repeat(64),
			},
		},
	};
}
