import { describe, expect, it } from 'vitest';
import { getBlueprintFilesystemIdentity } from './blueprint-filesystem-identity';

describe('getBlueprintFilesystemIdentity', () => {
	it('uses the setup creation revision when available', () => {
		expect(
			getBlueprintFilesystemIdentity({
				metadata: {
					id: 'site-id',
					whenCreated: 123,
					sourceSetupUrlFingerprint: 'fingerprint',
				},
			})
		).toBe('site-id:created:123');
	});

	it('falls back to the setup fingerprint for older sites', () => {
		expect(
			getBlueprintFilesystemIdentity({
				metadata: {
					id: 'site-id',
					sourceSetupUrlFingerprint: 'fingerprint',
				},
			})
		).toBe('site-id:source:fingerprint');
	});

	it('still distinguishes legacy sites without setup metadata', () => {
		expect(
			getBlueprintFilesystemIdentity({
				metadata: { id: 'site-id' },
			})
		).toBe('site-id:initial');
	});
});
