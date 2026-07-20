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
			label: 'E_NOTICE',
			tier: 'info',
			timestamp: '20-Jul-2026 14:59:46 UTC',
		});
		// The record text is preserved as logged — stamp and severity
		// head included.
		expect(entries[0].raw).toBe(
			'[20-Jul-2026 14:59:46 UTC] PHP Notice:  Function _load_textdomain_just_in_time was called incorrectly.'
		);
		expect(entries[1]).toMatchObject({
			channel: 'PHP',
			label: 'Database error',
			tier: 'error',
		});
		// Continuation lines stay inside their record instead of becoming
		// separate entries.
		expect(entries[1].raw.split('\n')).toHaveLength(3);
		expect(entries[1].raw).toContain('MySQL query');
	});

	it('labels PHP error levels with their error_reporting constants', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] PHP Fatal error:  Uncaught Error: boom',
			'[20-Jul-2026 14:59:46 UTC] PHP Warning:  Undefined variable $x',
			'[20-Jul-2026 14:59:46 UTC] PHP Deprecated:  Optional parameter',
			'[20-Jul-2026 14:59:46 UTC] PHP Custom notice:  hello',
		]);
		expect(entries.map((entry) => entry.tier)).toEqual([
			'error',
			'warning',
			'warning',
			'info',
		]);
		expect(entries[0].label).toBe('E_ERROR');
		expect(entries[1].label).toBe('E_WARNING');
		expect(entries[2].label).toBe('E_DEPRECATED');
		// Heads outside PHP's own vocabulary keep their verbatim text.
		expect(entries[3].label).toBe('Custom notice');
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

	it('treats unrecognized stamped records as PHP output', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] Cron reschedule event error for hook',
		]);
		expect(entries[0]).toMatchObject({
			channel: 'PHP',
			label: 'Log',
			tier: 'info',
			timestamp: '20-Jul-2026 14:59:46 UTC',
		});
	});

	it('keeps records without a timestamp instead of dropping them', () => {
		const entries = parseLogs(['stray line']);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			timestamp: null,
			raw: 'stray line',
		});
	});

	it('preserves the raw record text', () => {
		const record =
			'[20-Jul-2026 14:59:46 UTC] PHP Notice:  Something happened';
		expect(parseLogs([record])[0].raw).toBe(record);
	});
});
