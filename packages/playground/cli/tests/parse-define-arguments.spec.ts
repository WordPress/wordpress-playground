import { parseDefineArguments } from '../src/mounts';

describe('parseDefineArguments', () => {
	it('should parse boolean true when no value is provided', () => {
		const result = parseDefineArguments(['MY_FEATURE']);
		expect(result).toEqual({ MY_FEATURE: true });
	});

	it('should parse boolean values', () => {
		const result = parseDefineArguments([
			'DEBUG=true',
			'PRODUCTION=false',
			'ENABLE=True',
			'DISABLE=FALSE',
		]);
		expect(result).toEqual({
			DEBUG: true,
			PRODUCTION: false,
			ENABLE: true,
			DISABLE: false,
		});
	});

	it('should parse numeric values', () => {
		const result = parseDefineArguments([
			'LIMIT=100',
			'RATE=45.67',
			'NEGATIVE=-10',
		]);
		expect(result).toEqual({
			LIMIT: 100,
			RATE: 45.67,
			NEGATIVE: -10,
		});
	});

	it('should skip null values (PHP constants cannot be null)', () => {
		const result = parseDefineArguments([
			'VALUE=null',
			'OTHER=NULL',
			'MIXED=Null',
			'STRING=test',
		]);
		// Null values should be skipped
		expect(result).toEqual({
			STRING: 'test',
		});
	});

	it('should parse string values', () => {
		const result = parseDefineArguments([
			'NAME=John',
			'TITLE=Hello World',
			'PATH=/some/path',
		]);
		expect(result).toEqual({
			NAME: 'John',
			TITLE: 'Hello World',
			PATH: '/some/path',
		});
	});

	it('should handle mixed types', () => {
		const result = parseDefineArguments([
			'WP_DEBUG=true',
			'CUSTOM_LIMIT=100',
			'API_KEY=abc123',
			'TIMEOUT=30.5',
			'CACHE=null',
			'MY_FEATURE',
		]);
		expect(result).toEqual({
			WP_DEBUG: true,
			CUSTOM_LIMIT: 100,
			API_KEY: 'abc123',
			TIMEOUT: 30.5,
			// CACHE is skipped because it's null
			MY_FEATURE: true,
		});
	});

	it('should handle empty value as string', () => {
		const result = parseDefineArguments(['EMPTY=']);
		expect(result).toEqual({ EMPTY: '' });
	});

	it('should trim whitespace from names and values', () => {
		const result = parseDefineArguments(['  NAME  =  value  ', '  FLAG  ']);
		expect(result).toEqual({
			NAME: 'value',
			FLAG: true,
		});
	});

	it('should throw error for empty constant name', () => {
		expect(() => parseDefineArguments([''])).toThrow(
			'Invalid constant definition: empty constant name'
		);
	});

	it('should throw error for constant with empty name but has equals sign', () => {
		expect(() => parseDefineArguments(['=value'])).toThrow(
			'Constant name cannot be empty'
		);
	});

	it('should handle constants with equals sign in the value', () => {
		const result = parseDefineArguments(['EQUATION=a=b']);
		expect(result).toEqual({ EQUATION: 'a=b' });
	});

	it('should handle multiple constants', () => {
		const result = parseDefineArguments([
			'CONST1=value1',
			'CONST2=value2',
			'CONST3',
		]);
		expect(result).toEqual({
			CONST1: 'value1',
			CONST2: 'value2',
			CONST3: true,
		});
	});
});
