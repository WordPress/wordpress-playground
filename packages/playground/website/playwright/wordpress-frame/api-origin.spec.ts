import { expect, test } from '@playwright/test';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

const unrelated = new URL(appOrigin);
unrelated.hostname = '127.0.0.1';

for (const callerOrigin of [wordPressOrigin, unrelated.origin]) {
	test(`the saved-site API rejects its parent at ${callerOrigin}`, async ({
		page,
	}) => {
		// Real HTTP documents preserve the loopback address space for Chromium's
		// Local Network Access checks. A fulfilled mock can block the API navigation.
		const callerUrl = new URL('/manifest.json', callerOrigin).href;
		await page.goto(appOrigin + '/manifest.json');
		await page.evaluate((url) => {
			const caller = document.createElement('iframe');
			caller.src = url;
			document.body.append(caller);
		}, callerUrl);
		const callerElement = await page.locator('iframe').elementHandle();
		const caller = (await callerElement!.contentFrame())!;
		await caller.waitForURL(callerUrl);
		await caller.evaluate((origin) => {
			const api = document.createElement('iframe');
			api.src = new URL('/api.html', origin).href;
			document.body.append(api);
		}, appOrigin);
		const apiElement = await caller.locator('iframe').elementHandle();
		const api = (await apiElement!.contentFrame())!;
		await api.waitForFunction(
			() => Boolean((window as any).playgroundAPI),
			undefined,
			{ timeout: 30000, polling: 100 }
		);
		const requestId = crypto.randomUUID();
		await api.evaluate((id) => {
			const api = (window as any).playgroundAPI;
			const exportSite = api.exportSavedSiteAsZip;
			(window as any).exportCalls = 0;
			api.exportSavedSiteAsZip = (...args: unknown[]) => {
				(window as any).exportCalls++;
				return exportSite(...args);
			};
			// This observer runs after the real RPC listener. Its receipt proves that
			// the forbidden request was delivered, without treating a boot failure as denial.
			window.addEventListener('message', (event) => {
				if (event.data?.id === id)
					(event.source as Window).postMessage(
						{ type: 'api-probe-received', id },
						event.origin
					);
			});
		}, requestId);
		await caller.evaluate(
			({ id, origin }) =>
				new Promise<void>((resolve, reject) => {
					const api =
						document.querySelector('iframe')!.contentWindow!;
					const timer = setTimeout(
						() =>
							finish(
								new Error(
									'The API did not receive the request.'
								)
							),
						10000
					);
					function finish(error?: Error) {
						clearTimeout(timer);
						window.removeEventListener('message', onMessage);
						error ? reject(error) : resolve();
					}
					function onMessage(event: MessageEvent) {
						if (
							event.source === api &&
							event.origin === origin &&
							event.data?.id === id &&
							event.data.type === 'api-probe-received'
						)
							finish();
					}
					window.addEventListener('message', onMessage);
					api.postMessage(
						{
							id,
							type: 'APPLY',
							path: ['exportSavedSiteAsZip'],
							argumentList: [
								{ type: 'RAW', value: 'saved-site-probe' },
							],
						},
						origin
					);
				}),
			{ id: requestId, origin: appOrigin }
		);
		expect(await api.evaluate(() => (window as any).exportCalls)).toBe(0);
	});
}
