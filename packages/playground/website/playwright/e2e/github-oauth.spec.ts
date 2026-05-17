import { test, expect } from '@playwright/test';

const OAUTH_MESSAGE_TYPE = 'playground-github-oauth-token';

declare global {
	interface Window {
		__githubOAuthPageLoads?: number;
	}
}

test('authenticates with GitHub in a popup without reloading Playground', async ({
	page,
	browserName,
}) => {
	await page.addInitScript(() => {
		window.__githubOAuthPageLoads =
			(window.__githubOAuthPageLoads || 0) + 1;
	});
	if (browserName === 'firefox') {
		await page.addInitScript(() => {
			window.open = () => {
				const iframe = document.createElement('iframe');
				iframe.hidden = true;
				document.body.appendChild(iframe);
				return iframe.contentWindow;
			};
		});
	}

	let capturedState = '';
	let releasePopup!: () => void;
	const waitForRelease = new Promise<void>((resolve) => {
		releasePopup = resolve;
	});

	await page.context().route('**/oauth.php?redirect=1*', async (route) => {
		const requestUrl = new URL(route.request().url());
		capturedState = requestUrl.searchParams.get('state') || '';
		await waitForRelease;
		await route.fulfill({
			contentType: 'text/html',
			body: oauthCallbackPage(capturedState, 'gho_e2e_token'),
		});
	});

	await page.goto('./?gh-ensure-auth=yes');
	const dialog = page.getByRole('dialog', {
		name: 'Connect to GitHub',
	});
	await expect(dialog).toBeVisible();

	await page
		.getByRole('link', { name: 'Connect your GitHub account' })
		.click();

	await expect
		.poll(() => capturedState, {
			message: 'OAuth state should be passed to the popup',
		})
		.toMatch(/^playground-popup-/);

	await page.evaluate(
		({ state, type }) => {
			const iframe = document.createElement('iframe');
			document.body.appendChild(iframe);
			iframe.contentDocument!.write(`<script>
				window.parent.postMessage(
					${JSON.stringify({
						type,
						state,
						token: 'gho_wordpress_iframe_token',
					})},
					window.location.origin
				);
			</script>`);
			iframe.contentDocument!.close();
		},
		{ state: capturedState, type: OAUTH_MESSAGE_TYPE }
	);

	await expect(dialog).toBeVisible();
	releasePopup();
	await expect(dialog).not.toBeVisible();

	await expect
		.poll(() =>
			page.evaluate(() => window.__githubOAuthPageLoads)
		)
		.toBe(1);
});

function oauthCallbackPage(state: string, token: string) {
	return `<!doctype html>
<html>
	<body>
		<script>
			(window.opener || window.parent).postMessage(
				${JSON.stringify({
					type: OAUTH_MESSAGE_TYPE,
					state,
					token,
				})},
				window.location.origin
			);
			window.close();
		</script>
	</body>
</html>`;
}
