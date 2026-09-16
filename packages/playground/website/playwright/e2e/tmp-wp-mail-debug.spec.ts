import { test, expect } from '../playground-fixtures';

for (const php of ['7.4', '5.6']) {
	test(`debug wp_mail() on PHP ${php}`, async ({ website }) => {
		await website.goto(`./?storage=temp&php=${php}`);

		const result = await website.page.evaluate(async () => {
			const sitesApi = (window as any).playgroundSites;
			await sitesApi.isReady();
			const client = sitesApi.getClient();
			const response = await client.run({
				code: `<?php
				require_once '/wordpress/wp-load.php';
				add_action('wp_mail_failed', function ($error) {
					echo 'MAIL_FAILED: ' . $error->get_error_message() . "\\n";
				});
				$result = wp_mail('test@example.com', 'Hello', 'From the console');
				echo 'RESULT: ' . var_export($result, true) . ' PHP: ' . PHP_VERSION . "\\n";
				`,
			});
			return {
				text: new TextDecoder().decode(response.bytes),
				errors: response.errors,
				exitCode: response.exitCode,
			};
		});

		console.log(`=== PHP ${php} OUTPUT ===`);
		console.log(result.text);
		console.log('=== ERRORS ===', result.errors, 'EXIT', result.exitCode);
		expect(result.exitCode).toBe(0);
	});
}
