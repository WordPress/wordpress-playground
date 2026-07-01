import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import { getAppBaseUrl } from './state/url/app-base-url';

export const HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM =
	'playground-recovery-mode';
export const HEALTH_CHECK_RECOVERY_MODE_QUERY_VALUE = 'health-check';
const HEALTH_CHECK_DISABLE_PLUGIN_HASH_PARAM =
	'health-check-disable-plugin-hash';

//
// The Health Check MU-plugin requires a database option 'health-check-disable-plugin-hash'
// that matches: cookieValue + md5(REMOTE_ADDR). We add an earlier MU-plugin (alphabetically)
// that uses pre_option filter to return the expected hash, bypassing the database check.
export const healthCheckRecoveryBlueprint: BlueprintV1Declaration = {
	steps: [
		{
			step: 'installPlugin',
			pluginData: {
				resource: 'wordpress.org/plugins',
				slug: 'health-check',
			},
			options: {
				activate: false,
			},
		},
		{
			step: 'mkdir',
			path: '/wordpress/wp-content/mu-plugins',
		},
		{
			step: 'cp',
			fromPath:
				'/wordpress/wp-content/plugins/health-check/mu-plugin/health-check-troubleshooting-mode.php',
			toPath: '/wordpress/wp-content/mu-plugins/health-check-troubleshooting-mode.php',
		},
		{
			// Add an MU-plugin that loads before health-check (alphabetically: "0" < "h")
			// to provide the expected hash via pre_option filter
			step: 'writeFile',
			path: '/wordpress/wp-content/mu-plugins/0-health-check-hash-bypass.php',
			data: `<?php
// Bypass Health Check hash verification by setting both the GET param and option.
// Self-delete when user disables troubleshooting mode via Health Check UI.
if (isset($_GET['health-check-disable-troubleshooting'])) {
    unlink(__FILE__);
} else {
    $_GET['health-check-disable-plugin-hash'] = 'playground-recovery';
    add_filter('pre_option_health-check-disable-plugin-hash', function() {
        return 'playground-recovery';
    });
    // Don't try to switch to a default theme
    add_filter('pre_option_health-check-default-theme', function() {
        return 'no';
    });
    // Add admin notice with guidance
    add_action('admin_notices', function() {
        ?>
        <div class="notice notice-warning">
            <p><strong>Troubleshooting Mode Active</strong></p>
            <p>All plugins have been disabled. You can now activate them one by one to find the problematic one.</p>
            <p>Once fixed, disable troubleshooting mode via <a href="<?php echo admin_url('site-health.php?tab=troubleshoot'); ?>">Site Health &rarr; Troubleshoot</a>.</p>
        </div>
        <?php
    });
}
`,
		},
		{
			step: 'login',
		},
	],
	landingPage:
		'/wp-admin/plugins.php?health-check-disable-plugin-hash=playground-recovery',
};

export function isHealthCheckRecoveryBlueprint(
	blueprint?: BlueprintV1Declaration | { landingPage?: string } | null
) {
	if (!blueprint || typeof blueprint !== 'object') {
		return false;
	}
	const landingPage = 'landingPage' in blueprint ? blueprint.landingPage : '';
	return (
		typeof landingPage === 'string' &&
		landingPage.includes(HEALTH_CHECK_DISABLE_PLUGIN_HASH_PARAM)
	);
}

export function isHealthCheckRecoveryUrl(url: URL): boolean {
	return (
		url.searchParams.get(HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM) ===
		HEALTH_CHECK_RECOVERY_MODE_QUERY_VALUE
	);
}

export function getHealthCheckRecoveryUrl(): string {
	const url = getAppBaseUrl();
	const currentUrl = new URL(window.location.href);
	const siteSlug = currentUrl.searchParams.get('site-slug');
	if (siteSlug) {
		url.searchParams.set('site-slug', siteSlug);
	}
	url.searchParams.set(
		HEALTH_CHECK_RECOVERY_MODE_QUERY_PARAM,
		HEALTH_CHECK_RECOVERY_MODE_QUERY_VALUE
	);
	return url.toString();
}
