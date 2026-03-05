import {
	parseDefineStringArguments,
	parseDefineBoolArguments,
	parseDefineNumberArguments,
} from '../src/defines';

describe('parseDefineStringArguments', () => {
	it('should parse string constants with values', () => {
		const result = parseDefineStringArguments([
			'API_KEY',
			'secret123',
			'TITLE',
			'Hello World',
			'PATH',
			'/some/path',
		]);
		expect(result).toEqual({
			API_KEY: 'secret123',
			TITLE: 'Hello World',
			PATH: '/some/path',
		});
	});

	it('should handle empty string value', () => {
		const result = parseDefineStringArguments(['EMPTY', '']);
		expect(result).toEqual({ EMPTY: '' });
	});

	it('should preserve string values that look like other types', () => {
		const result = parseDefineStringArguments([
			'LOOKS_BOOL',
			'true',
			'LOOKS_NUM',
			'123',
			'LOOKS_NULL',
			'null',
		]);
		expect(result).toEqual({
			LOOKS_BOOL: 'true',
			LOOKS_NUM: '123',
			LOOKS_NULL: 'null',
		});
	});

	it('should handle equals sign in constant names and values', () => {
		const result = parseDefineStringArguments([
			'CON=ST',
			'va=lu=e',
			'NAME',
			'a=b=c',
		]);
		expect(result).toEqual({
			'CON=ST': 'va=lu=e',
			NAME: 'a=b=c',
		});
	});

	it('should trim constant names but preserve value whitespace', () => {
		const result = parseDefineStringArguments(['  NAME  ', '  value  ']);
		expect(result).toEqual({ NAME: '  value  ' });
	});

	it('should throw error for empty constant name', () => {
		expect(() => parseDefineStringArguments(['', 'value'])).toThrow(
			'Constant name cannot be empty'
		);
	});

	it('should throw error for odd number of arguments', () => {
		expect(() =>
			parseDefineStringArguments(['API_KEY', 'secret', 'TITLE'])
		).toThrow('Invalid constant definition format');
	});
});

describe('parseDefineBoolArguments', () => {
	it('should parse boolean constants with explicit values', () => {
		const result = parseDefineBoolArguments([
			'DEBUG',
			'true',
			'PRODUCTION',
			'false',
			'ENABLE',
			'1',
			'DISABLE',
			'0',
		]);
		expect(result).toEqual({
			DEBUG: true,
			PRODUCTION: false,
			ENABLE: true,
			DISABLE: false,
		});
	});

	it('should be case-insensitive for boolean values', () => {
		const result = parseDefineBoolArguments([
			'VAL1',
			'TRUE',
			'VAL2',
			'False',
			'VAL3',
			'TrUe',
		]);
		expect(result).toEqual({
			VAL1: true,
			VAL2: false,
			VAL3: true,
		});
	});

	it('should throw error for invalid boolean values', () => {
		expect(() => parseDefineBoolArguments(['FLAG', 'yes'])).toThrow(
			'Invalid boolean value for constant "FLAG": "yes". Must be "true", "false", "1", or "0".'
		);
	});

	it('should throw error for empty constant name', () => {
		expect(() => parseDefineBoolArguments(['', 'true'])).toThrow(
			'Constant name cannot be empty'
		);
	});

	it('should trim whitespace from names and values', () => {
		const result = parseDefineBoolArguments(['  NAME  ', '  true  ']);
		expect(result).toEqual({
			NAME: true,
		});
	});

	it('should throw error for odd number of arguments', () => {
		expect(() =>
			parseDefineBoolArguments(['DEBUG', 'true', 'PRODUCTION'])
		).toThrow('Invalid boolean constant definition format');
	});
});

describe('parseDefineNumberArguments', () => {
	it('should parse integer and float values', () => {
		const result = parseDefineNumberArguments([
			'LIMIT',
			'100',
			'RATE',
			'45.67',
			'NEGATIVE',
			'-10',
			'ZERO',
			'0',
		]);
		expect(result).toEqual({
			LIMIT: 100,
			RATE: 45.67,
			NEGATIVE: -10,
			ZERO: 0,
		});
	});

	it('should throw error for non-numeric values', () => {
		expect(() => parseDefineNumberArguments(['NUM', 'abc'])).toThrow(
			'Invalid number value for constant "NUM": "abc". Must be a valid number.'
		);
	});

	it('should throw error for empty constant name', () => {
		expect(() => parseDefineNumberArguments(['', '123'])).toThrow(
			'Constant name cannot be empty'
		);
	});

	it('should handle scientific notation', () => {
		const result = parseDefineNumberArguments([
			'SCI',
			'1e5',
			'SCI2',
			'2.5e-3',
		]);
		expect(result).toEqual({
			SCI: 100000,
			SCI2: 0.0025,
		});
	});

	it('should throw error for odd number of arguments', () => {
		expect(() =>
			parseDefineNumberArguments(['LIMIT', '100', 'RATE'])
		).toThrow('Invalid number constant definition format');
	});
});
