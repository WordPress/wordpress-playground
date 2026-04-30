import { MessageChannel } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { exposeAPI } from './api';

describe('exposeAPI', () => {
	it('calls piped API methods with the piped API as this', async () => {
		const { port1 } = new MessageChannel();
		const pipedApi = {
			value: 'bound',
			getValue() {
				return this.value;
			},
		};
		const [, , exposedApi] = exposeAPI({}, pipedApi, port1 as any);

		expect((exposedApi as any).getValue()).toBe('bound');
	});
});
