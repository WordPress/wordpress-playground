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
		// The stamp is lifted; the severity head stays in the text and its
		// span is reported so the UI can tint exactly that substring.
		expect(entries[0]).toMatchObject({
			tier: 'info',
			timestamp: '20-Jul-2026 14:59:46 UTC',
			message:
				'PHP Notice:  Function _load_textdomain_just_in_time was called incorrectly.',
			headLength: 'PHP Notice:'.length,
		});
		expect(entries[1]).toMatchObject({
			tier: 'error',
			headLength: 'WordPress database error'.length,
		});
		// Continuation lines stay inside their record instead of becoming
		// separate entries.
		expect(entries[1].message.split('\n')).toHaveLength(3);
		expect(entries[1].message).toContain('MySQL query');
	});

	it('classifies PHP error levels into tiers', () => {
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
		expect(entries[0].message).toBe(
			'PHP Fatal error:  Uncaught Error: boom'
		);
		expect(entries[0].headLength).toBe('PHP Fatal error:'.length);
	});

	it('drops Playground host records and keeps PHP ones', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] JavaScript error: ReferenceError: x is not defined',
			'[20-Jul-2026 14:59:46 UTC] Wasm Crash fatal: Aborted()',
			'[20-Jul-2026 14:59:46 UTC] PHP fatal: request aborted',
		]);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			tier: 'error',
			message: 'PHP fatal: request aborted',
			headLength: 'PHP fatal:'.length,
		});
	});

	it('treats unrecognized stamped records as plain output', () => {
		const entries = parseLogs([
			'[20-Jul-2026 14:59:46 UTC] Cron reschedule event error for hook',
		]);
		expect(entries[0]).toMatchObject({
			tier: 'info',
			timestamp: '20-Jul-2026 14:59:46 UTC',
			message: 'Cron reschedule event error for hook',
			headLength: 0,
		});
	});

	it('lifts the timestamp only when it matches the exact stamp format', () => {
		const entries = parseLogs(['[20-Jul-2026 14:59:46] missing timezone']);
		expect(entries[0]).toMatchObject({
			timestamp: null,
			message: '[20-Jul-2026 14:59:46] missing timezone',
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
