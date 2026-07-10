import { describe, expect, it } from 'vitest';
import {
	advanceFrameScanEpoch,
	isLatestFrameScan,
	type FrameScanRegistry,
} from './frame-scan-registry';

describe('frame scan registry', () => {
	it('rejects older scans and scans superseded by an unsolicited status', () => {
		const registry: FrameScanRegistry = new Map();
		const firstScan = advanceFrameScanEpoch(
			registry,
			1,
			2,
			'first-document'
		);
		const secondScan = advanceFrameScanEpoch(
			registry,
			1,
			2,
			'first-document'
		);

		expect(
			isLatestFrameScan(registry, 1, 2, 'first-document', firstScan)
		).toBe(false);
		expect(
			isLatestFrameScan(registry, 1, 2, 'first-document', secondScan)
		).toBe(true);
		const unsolicitedStatus = advanceFrameScanEpoch(
			registry,
			1,
			2,
			'first-document'
		);
		expect(
			isLatestFrameScan(registry, 1, 2, 'first-document', secondScan)
		).toBe(false);
		expect(
			isLatestFrameScan(
				registry,
				1,
				2,
				'first-document',
				unsolicitedStatus
			)
		).toBe(true);
	});

	it('invalidates a pending scan when its document returns from BFCache', () => {
		const registry: FrameScanRegistry = new Map();
		const pendingScan = advanceFrameScanEpoch(
			registry,
			1,
			2,
			'first-document'
		);

		advanceFrameScanEpoch(registry, 1, 2, 'second-document');
		const restoredDocumentActivation = advanceFrameScanEpoch(
			registry,
			1,
			2,
			'first-document'
		);
		expect(
			isLatestFrameScan(registry, 1, 2, 'first-document', pendingScan)
		).toBe(false);
		expect(
			isLatestFrameScan(
				registry,
				1,
				2,
				'first-document',
				restoredDocumentActivation
			)
		).toBe(true);

		const restoredDocumentScan = advanceFrameScanEpoch(
			registry,
			1,
			2,
			'first-document'
		);
		expect(
			isLatestFrameScan(
				registry,
				1,
				2,
				'first-document',
				restoredDocumentActivation
			)
		).toBe(false);
		expect(
			isLatestFrameScan(
				registry,
				1,
				2,
				'first-document',
				restoredDocumentScan
			)
		).toBe(true);
	});
});
