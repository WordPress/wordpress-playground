import { describe, it, expect } from 'vitest';

describe('execArgv check', () => {
	it('should show execArgv', () => {
		console.log('process.execArgv:', process.execArgv);
		expect(true).toBe(true);
	});
});
