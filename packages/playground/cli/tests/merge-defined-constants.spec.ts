import { mergeDefinedConstants } from '../src/defines';

describe('mergeDefinedConstants', () => {
	it('should merge string, boolean, and number constants', () => {
		const result = mergeDefinedConstants({
			define: { API_KEY: 'secret' },
			'define-bool': { WP_DEBUG: true },
			'define-number': { LIMIT: 100 },
		});
		expect(result).toEqual({
			API_KEY: 'secret',
			WP_DEBUG: true,
			LIMIT: 100,
		});
	});

	it('should return empty object when no constants are provided', () => {
		const result = mergeDefinedConstants({});
		expect(result).toEqual({});
	});

	it('should inject PLAYGROUND_AUTO_LOGIN_AS_USER when login is true', () => {
		const result = mergeDefinedConstants({ login: true });
		expect(result).toEqual({
			PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
		});
	});

	it('should not inject login constant when login is false', () => {
		const result = mergeDefinedConstants({ login: false });
		expect(result).toEqual({});
	});

	it('should not inject login constant when login is undefined', () => {
		const result = mergeDefinedConstants({});
		expect(result).toEqual({});
	});

	it('should not override explicit PLAYGROUND_AUTO_LOGIN_AS_USER from --define', () => {
		const result = mergeDefinedConstants({
			define: { PLAYGROUND_AUTO_LOGIN_AS_USER: 'editor' },
			login: true,
		});
		expect(result).toEqual({
			PLAYGROUND_AUTO_LOGIN_AS_USER: 'editor',
		});
	});

	it('should preserve other constants alongside the injected login constant', () => {
		const result = mergeDefinedConstants({
			define: { API_KEY: 'secret' },
			'define-bool': { WP_DEBUG: true },
			login: true,
		});
		expect(result).toEqual({
			API_KEY: 'secret',
			WP_DEBUG: true,
			PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
		});
	});
});
