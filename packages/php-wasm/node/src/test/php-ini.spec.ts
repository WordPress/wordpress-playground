import {
	LatestSupportedPHPVersion,
	PHP,
	PHP_EXTENSIONS_DIR,
	getPhpIniEntries,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { loadNodeRuntime } from '../lib';

describe('php.ini manipulation', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(LatestSupportedPHPVersion));
		php.writeFile(
			'/internal/shared/php.ini',
			`memory_limit = 128M
max_execution_time = 30 ; seconds
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
display_errors = On
log_errors = On
custom_setting = true
`
		);
	});

	afterEach(async () => {
		php.exit();
	});

	describe('getPhpIniEntries', () => {
		it('returns the correct values', async () => {
			const result = await getPhpIniEntries(php, [
				'memory_limit',
				'error_reporting',
				'custom_setting',
			]);
			expect(result).toEqual({
				memory_limit: '128M',
				error_reporting: 'E_ALL & ~E_DEPRECATED & ~E_STRICT',
				custom_setting: true,
			});
		});

		it('returns all values if no entries are specified', async () => {
			const result = await getPhpIniEntries(php, undefined);
			expect(result).toEqual({
				memory_limit: '128M',
				max_execution_time: '30',
				error_reporting: 'E_ALL & ~E_DEPRECATED & ~E_STRICT',
				display_errors: 'On',
				log_errors: 'On',
				custom_setting: true,
			});
		});

		it('returns an empty object if no entries are found', async () => {
			const result = await getPhpIniEntries(php, ['not_found']);
			expect(result).toEqual({});
		});
	});

	describe('setPhpIniEntries', () => {
		it('sets the correct values', async () => {
			await setPhpIniEntries(php, {
				memory_limit: '256M',
				error_reporting: 'E_ALL',
				custom_setting: false,
			});
			const result = await getPhpIniEntries(php, [
				'memory_limit',
				'error_reporting',
				'custom_setting',
			]);
			expect(result).toEqual({
				memory_limit: '256M',
				error_reporting: 'E_ALL',
				custom_setting: false,
			});
		});

		it('deletes entries with null or undefined values', async () => {
			await setPhpIniEntries(php, {
				memory_limit: null,
				error_reporting: undefined,
			});
			const result = await getPhpIniEntries(php, [
				'memory_limit',
				'error_reporting',
			]);
			expect(result).toEqual({});
		});

		it('does not delete entries with empty strings', async () => {
			await setPhpIniEntries(php, {
				memory_limit: '',
				error_reporting: '',
			});
			const result = await getPhpIniEntries(php, [
				'memory_limit',
				'error_reporting',
			]);
			expect(result).toEqual({
				memory_limit: '',
				error_reporting: '',
			});
		});
	});

	describe('setPhpIniEntries with a target path', () => {
		const xdebugIniPath = joinPaths(PHP_EXTENSIONS_DIR, 'xdebug.ini');
		let phpWithXdebug: PHP;

		beforeEach(async () => {
			phpWithXdebug = new PHP(
				await loadNodeRuntime(LatestSupportedPHPVersion, {
					extensions: ['xdebug'],
				})
			);
		});

		afterEach(async () => {
			phpWithXdebug.exit();
		});

		it('writes to the given file instead of php.ini', async () => {
			await setPhpIniEntries(
				phpWithXdebug,
				{ 'xdebug.mode': 'develop,trace,profile' },
				xdebugIniPath
			);
			expect(
				await getPhpIniEntries(
					phpWithXdebug,
					['xdebug.mode'],
					xdebugIniPath
				)
			).toEqual({ 'xdebug.mode': 'develop,trace,profile' });
			expect(
				await getPhpIniEntries(phpWithXdebug, ['xdebug.mode'])
			).toEqual({});
		});

		it('keeps the entries already in the file', async () => {
			const before = await getPhpIniEntries(
				phpWithXdebug,
				undefined,
				xdebugIniPath
			);
			await setPhpIniEntries(
				phpWithXdebug,
				{ 'xdebug.mode': 'develop,trace,profile' },
				xdebugIniPath
			);
			expect(
				await getPhpIniEntries(phpWithXdebug, undefined, xdebugIniPath)
			).toEqual({
				...before,
				'xdebug.mode': 'develop,trace,profile',
			});
		});

		it('overrides the value the extension shipped', async () => {
			expect(
				await getPhpIniEntries(
					phpWithXdebug,
					['xdebug.mode'],
					xdebugIniPath
				)
			).not.toEqual({ 'xdebug.mode': 'develop,trace,profile' });

			await setPhpIniEntries(
				phpWithXdebug,
				{ 'xdebug.mode': 'develop,trace,profile' },
				xdebugIniPath
			);
			const result = await phpWithXdebug.run({
				code: `<?php echo ini_get('xdebug.mode');`,
			});
			expect(result.text).toBe('develop,trace,profile');
		});
	});

	describe('integration', () => {
		it('setPhpIniEntries(getPhpIniEntries()) does not affect the ini values', async () => {
			const initialIniValues = await getPhpIniEntries(php);
			await setPhpIniEntries(php, initialIniValues);
			const updatedIniValues = await getPhpIniEntries(php);
			expect(updatedIniValues).toEqual(initialIniValues);
		});
	});
});
