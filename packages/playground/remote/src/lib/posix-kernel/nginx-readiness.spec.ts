import { describe, expect, it } from 'vitest';

import { waitForNginx } from './nginx-readiness';
import type { HttpResponse } from './host-bridge';

function respond(status: number): HttpResponse {
	return { status } as HttpResponse;
}

describe('waitForNginx', () => {
	it('retries while the upstream returns a transient gateway status', async () => {
		const statuses = [502, 503, 200];
		let sends = 0;
		await waitForNginx(async () => respond(statuses[sends++]), 1000, 1);
		expect(sends).toBe(3);
	});

	it('treats a 500 as ready instead of retrying a real PHP error', async () => {
		let sends = 0;
		await waitForNginx(
			async () => {
				sends++;
				return respond(500);
			},
			1000,
			1
		);
		expect(sends).toBe(1);
	});

	it('throws with the last status when the upstream stays down', async () => {
		await expect(
			waitForNginx(async () => respond(502), 30, 1)
		).rejects.toThrow('last status was 502');
	});
});
