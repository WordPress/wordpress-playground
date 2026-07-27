import { describe, expect, it } from 'vitest';
import { serializeDnsRecords } from './wasm-user-space';

describe('serializeDnsRecords', () => {
	it('serializes A records using hex-encoded fields', () => {
		expect(serializeDnsRecords('A', ['192.0.2.1'])).toBe(
			'A\t3139322e302e322e31'
		);
	});

	it('maps every Node CAA property to a PHP CAA record', () => {
		expect(
			serializeDnsRecords('CAA', [
				{
					critical: 128,
					issue: 'letsencrypt.org',
					issuewild: 'wild.example.test',
					iodef: 'mailto:security@example.test',
				},
			])
		).toBe(
			'CAA\t313238\t6973737565\t6c657473656e63727970742e6f7267\n' +
				'CAA\t313238\t697373756577696c64\t77696c642e6578616d706c652e74657374\n' +
				'CAA\t313238\t696f646566\t6d61696c746f3a7365637572697479406578616d706c652e74657374'
		);
	});

	it('returns no wire records for unsupported types', () => {
		expect(serializeDnsRecords('HINFO', [])).toBe('');
	});
});
