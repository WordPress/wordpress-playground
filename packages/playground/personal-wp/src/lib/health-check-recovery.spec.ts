import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM,
	HEALTH_CHECK_RECOVERY_MODE_QUERY_VALUE,
	getHealthCheckRecoveryUrl,
	healthCheckRecoveryBlueprint,
	isHealthCheckRecoveryBlueprint,
	isHealthCheckRecoveryUrl,
} from './health-check-recovery';

describe('Health Check recovery', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('generates app-base recovery URLs with only the recovery marker', () => {
		vi.stubGlobal('window', {
			location: {
				href: 'https://my.wordpress.net/wp-admin/plugins.php?plugin_status=all&site-slug=my-site#old-fragment',
				origin: 'https://my.wordpress.net',
			},
		});

		const url = new URL(getHealthCheckRecoveryUrl());

		expect(url.pathname).toBe(
			new URL(import.meta.env.BASE_URL, 'https://my.wordpress.net')
				.pathname
		);
		expect(url.hash).toBe('');
		expect(url.searchParams.has('blueprint-url')).toBe(false);
		expect(url.searchParams.has('plugin_status')).toBe(false);
		expect(url.searchParams.get('site-slug')).toBe('my-site');
		expect(
			url.searchParams.get(HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM)
		).toBe(HEALTH_CHECK_RECOVERY_MODE_QUERY_VALUE);
		expect(isHealthCheckRecoveryUrl(url)).toBe(true);
	});

	it('detects the recovery blueprint from its Health Check landing page', () => {
		expect(
			isHealthCheckRecoveryBlueprint(healthCheckRecoveryBlueprint)
		).toBe(true);
		expect(
			isHealthCheckRecoveryBlueprint({ landingPage: '/wp-admin/' })
		).toBe(false);
	});
});
