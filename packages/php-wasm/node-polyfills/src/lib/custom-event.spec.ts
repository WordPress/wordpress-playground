import './custom-event';

describe('CustomEvent class', () => {
	it('Should exist', () => {
		expect(CustomEvent).not.toBe(undefined);
	});
	it('Should be possible to construct', () => {
		const instance = new CustomEvent('test', {
			detail: {
				custom: 'data',
			},
		});
		expect(instance).not.toBe(undefined);
		expect(instance.detail).toEqual({
			custom: 'data',
		});
	});
});
