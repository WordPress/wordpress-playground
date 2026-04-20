import { test, expect } from '../playground-fixtures';

test('blocks loopback HTTP requests during shutdown while prefetching update checks', async ({
	website,
}) => {
	const optionName = 'wppg_shutdown_loopback_prefetch_result';

	const blueprint = {
		steps: [
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/shutdown-loopback-prefetch.php',
				data: `<?php
/**
 * Captures the outcome of a loopback HTTP request performed during the shutdown
 * hook. This is expected to be blocked by the loopback guard installed by
 * prefetchUpdateChecks() in wordpress-fetch-network-transport.ts.
 */
add_action( 'shutdown', function() {
	// Only run inside the prefetchUpdateChecks() PHP execution, which is
	// the only context that defines _wppg_is_loopback_request(). Polling
	// playground.run() calls also trigger shutdown and must be skipped.
	if ( ! function_exists( '_wppg_is_loopback_request' ) ) {
		return;
	}

	$option_name = '${optionName}';
	if ( get_option( $option_name, null ) !== null ) {
		return;
	}

	$url  = site_url( '/wp-cron.php?doing_wp_cron=1' );
	$resp = wp_remote_get(
		$url,
		array(
			'timeout'     => 5,
			'redirection' => 0,
		)
	);

	if ( is_wp_error( $resp ) ) {
		update_option(
			$option_name,
			wp_json_encode(
				array(
					'kind'    => 'wp_error',
					'code'    => $resp->get_error_code(),
					'message' => $resp->get_error_message(),
					'url'     => $url,
				)
			)
		);
		return;
	}

	update_option(
		$option_name,
		wp_json_encode(
			array(
				'kind'   => 'response',
				'status' => wp_remote_retrieve_response_code( $resp ),
				'url'    => $url,
			)
		)
	);
} );
`,
			},
		],
	};

	// Navigate without waiting for nested iframes. We only need the boot
	// process to run prefetchUpdateChecks(); we don't need wp-admin to render.
	await website.page.goto(
		`./?networking=yes&url=/wp-admin/#${JSON.stringify(blueprint)}`
	);

	// Wait for the playground client to be available (set before prefetch runs).
	await website.page.waitForFunction(
		() => Boolean((window as any).playground),
		{ timeout: 120_000 }
	);

	// Poll until the mu-plugin's shutdown hook has written the option.
	// prefetchUpdateChecks() may still be in progress when window.playground
	// appears, so we retry until the side-effect is visible.
	const raw = await website.page.evaluate(async (optName) => {
		const playground = (window as any).playground;
		const deadline = Date.now() + 60_000;
		while (Date.now() < deadline) {
			const result = await playground.run({
				code: `<?php
require_once '/wordpress/wp-load.php';
echo (string) get_option('${optName}', '');
`,
			});
			if (result.text) {
				return result.text;
			}
			await new Promise((r) => setTimeout(r, 500));
		}
		throw new Error('Timed out waiting for shutdown hook to store option');
	}, optionName);

	const parsed = JSON.parse(raw) as
		| {
				kind: 'wp_error';
				code: string;
				message: string;
				url: string;
		  }
		| { kind: 'response'; status: number; url: string };

	expect(parsed.kind).toBe('wp_error');
	if (parsed.kind === 'wp_error') {
		expect(parsed.code).toBe('http_request_block');
		expect(parsed.message).toBe('Loopback requests are not to be pre-fetched');
	}
});

