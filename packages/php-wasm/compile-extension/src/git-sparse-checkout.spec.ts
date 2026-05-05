import { describe, expect, it } from 'vitest';

import {
	createTreeFetchRequest,
	parseUploadPackResponse,
} from './git-sparse-checkout';

describe('parseUploadPackResponse', () => {
	it('skips protocol-v2 delimiter packets and stops at response-end packets', () => {
		const pack = Buffer.from('PACKtest');
		const response = Buffer.concat([
			Buffer.from('0001'),
			pktLine(Buffer.concat([Buffer.from([1]), pack])),
			Buffer.from('0002'),
			pktLine(Buffer.from('trailing data that should not be parsed')),
		]);

		expect(parseUploadPackResponse(response)).toEqual(pack);
	});
});

describe('createTreeFetchRequest', () => {
	it('sends a single done packet', () => {
		const request = createTreeFetchRequest(
			'0000000000000000000000000000000000000000'
		)
			.toString('utf8');

		expect(request.match(/done\n/g)).toHaveLength(1);
	});
});

function pktLine(value: Buffer): Buffer {
	return Buffer.concat([
		Buffer.from((value.length + 4).toString(16).padStart(4, '0')),
		value,
	]);
}
