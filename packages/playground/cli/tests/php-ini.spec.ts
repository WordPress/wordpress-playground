import { parsePhpIniArguments } from '../src/php-ini';

describe('parsePhpIniArguments', () => {
	it('should parse entries with values', () => {
		const result = parsePhpIniArguments([
			'memory_limit',
			'256M',
			'xdebug.mode',
			'develop,trace,profile',
		]);
		expect(result).toEqual({
			memory_limit: '256M',
			'xdebug.mode': 'develop,trace,profile',
		});
	});

	it('should handle empty string value', () => {
		const result = parsePhpIniArguments(['disable_functions', '']);
		expect(result).toEqual({ disable_functions: '' });
	});

	it('should trim entry names but preserve value whitespace', () => {
		const result = parsePhpIniArguments(['  memory_limit  ', '  256M  ']);
		expect(result).toEqual({ memory_limit: '  256M  ' });
	});

	it('should throw on an odd number of arguments', () => {
		expect(() => parsePhpIniArguments(['memory_limit'])).toThrow(
			'Invalid php.ini entry format. Expected pairs of NAME value'
		);
	});

	it('should throw on an empty entry name', () => {
		expect(() => parsePhpIniArguments(['   ', '256M'])).toThrow(
			'php.ini entry name cannot be empty'
		);
	});
});
