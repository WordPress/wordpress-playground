import { describe, expect, it } from 'vitest';
import { parseLogs } from './log-parsing';

describe('parseLogs', () => {
	it('splits a raw debug.log chunk into one entry per record', () => {
		const chunk = [
			'[20-Jul-2026 14:59:46 UTC] PHP Notice:  Function _load_textdomain_just_in_time was called incorrectly.',
			'[20-Jul-2026 14:59:47 UTC] WordPress database error <div style="clear:both">&nbsp;</div>',
			'<p>MySQL query:</p>',
			"<p>REPLACE INTO `wp_options` VALUES ('blogname','BrewCommerce','on')</p>",
		].join('\n');

		const entries = parseLogs([chunk]);

		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			channel: 'PHP',
			label: 'Notice',
			tier: 'info',
			timestamp: '20-Jul-2026 14:59:46 UTC',
		});
		expect(entries[0].message).toMatch(
			/^Function _load_textdomain_just_in_time/
		);
		expect(entries[1]).toMatchObject({
			channel: 'WordPress',
			label: 'Database error',
			tier: 'error',
		});
		// Continuation lines stay inside their record instead of becoming
		// separate entries.
		expect(entries[1].message.split('\n')).toHaveLength(3);
		expect(entries[1].message).toContain('MySQL query');
	});

	it('keeps severity tiers for the common PHP error levels', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] PHP Fatal error:  Uncaught Error: boom',
			'[20-Jul-2026 14:59:46 UTC] PHP Warning:  Undefined variable $x',
			'[20-Jul-2026 14:59:46 UTC] PHP Deprecated:  Optional parameter',
			'[20-Jul-2026 14:59:46 UTC] PHP User notice:  hello',
		]);
		expect(entries.map((entry) => entry.tier)).toEqual([
			'error',
			'warning',
			'warning',
			'info',
		]);
		expect(entries[0].label).toBe('Fatal error');
		expect(entries[0].message).toBe('Uncaught Error: boom');
		expect(entries[3].label).toBe('User notice');
	});

	it('maps formatted logger entries to their channel and severity', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] JavaScript error: ReferenceError: x is not defined',
			'[20-Jul-2026 14:59:46 UTC] Wasm Crash fatal: Aborted()',
			'[20-Jul-2026 14:59:46 UTC] PHP fatal: request aborted',
		]);
		expect(entries[0]).toMatchObject({
			channel: 'Playground',
			label: 'Error',
			tier: 'error',
			message: 'ReferenceError: x is not defined',
		});
		expect(entries[1]).toMatchObject({
			channel: 'Playground',
			label: 'Crash',
			tier: 'error',
		});
		expect(entries[2]).toMatchObject({
			channel: 'PHP',
			label: 'Fatal error',
			tier: 'error',
		});
	});

	it('treats unrecognized stamped records as WordPress output', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] Cron reschedule event error for hook',
		]);
		expect(entries[0]).toMatchObject({
			channel: 'WordPress',
			label: 'Log',
			tier: 'info',
			timestamp: '20-Jul-2026 14:59:46 UTC',
			message: 'Cron reschedule event error for hook',
		});
	});

	it('keeps records without a timestamp instead of dropping them', () => {
		const entries = parseLogs(['stray line']);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			timestamp: null,
			message: 'stray line',
		});
	});

	it('preserves the raw record text for copying', () => {
		const record =
			'[20-Jul-2026 14:59:46 UTC] PHP Notice:  Something happened';
		expect(parseLogs([record])[0].raw).toBe(record);
	});
});
