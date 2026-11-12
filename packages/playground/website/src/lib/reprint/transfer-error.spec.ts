import { describe, expect, it } from 'vitest';
import { getTransferRecovery } from './transfer-error';

// Recovery must follow the server's diagnosis, not just its HTTP status.
// Otherwise a permanent setup failure can look like a temporary 503.
describe('Reprint recovery', () => {
	it.each([
		['AUTH_NOT_CONFIGURED', 'settings', true],
		['AUTH_UNKNOWN_KEY', 'settings', true],
		['EXPORT_NOT_CONFIGURED', 'settings', true],
		['REDIRECT', 'address', false],
		['HTML_RESPONSE', 'install', true],
		['AUTH_KEY_UNSUPPORTED', 'plugins', true],
		['AUTH_REQUIRES_TOKEN', 'cli', false],
		['SITE_TOO_LARGE', 'cli', false],
		['AUTH_HEADERS_STRIPPED', 'admin', true],
		['AUTH_REQUEST_REWRITTEN', 'admin', true],
		['WORDFENCE_BLOCKED', 'wordfence', true],
		['LOGIN_FAILED', 'open-copy', true],
	] as const)(
		'uses %s before the generic HTTP fallback',
		(code, action, canContinue) => {
			const recovery = getTransferRecovery({ code, httpStatus: 503 });
			expect(recovery.action).toBe(action);
			expect(!!recovery.resumeLabel).toBe(canContinue);
		}
	);

	it.each([18, 28, 56])(
		'allows resuming an interrupted cURL connection (%s)',
		(curlError) => {
			expect(
				getTransferRecovery({ code: 'CURL_ERROR', curlError }).action
			).toBe('resume');
		}
	);

	it('does not treat a certificate failure as an interrupted download', () => {
		expect(
			getTransferRecovery({
				code: 'CURL_ERROR',
				curlError: 60,
				httpStatus: 503,
			}).action
		).toBe('site');
	});

	it('does not send an unexplained 403 back to key enrollment', () => {
		expect(
			getTransferRecovery({ code: 'AUTH_FAILED', httpStatus: 403 }).action
		).toBe('admin');
		expect(getTransferRecovery({ httpStatus: 403 }).action).toBe('resume');
	});
});
