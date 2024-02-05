import './crypto';

describe('crypto is loaded', () => {
	it('Should exist', () => {
		expect(crypto).not.toBe(undefined);
	});
	it('Returns a random', () => {
		expect(crypto.randomUUID().length).toBe(36);
	});
});
