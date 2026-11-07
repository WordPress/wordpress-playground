import { expect, test } from '@playwright/test';
import { joinPaths } from '@php-wasm/util';
import {
	appOrigin,
	wordPressOrigin,
} from '../../bin/wordpress-frame/origins.mjs';

// Contract: a real sandbox caller cannot turn a known saved-site name into storage
// access. Startup, derived RPC ports, late/internal calls, and shared discovery are
// independent paths. Use a persistent context: Safari OPFS is unavailable in the
// ephemeral WebKit fixture, and older Safari cannot clone native OPFS handles.
test(
	'saved storage requires the app-only runtime connection',
	{ tag: '@storage' },
	async ({ playwright, browserName }, testInfo) => {
		const context = await playwright[browserName].launchPersistentContext(
			testInfo.outputPath('storage-profile'),
			{
				...testInfo.project.use.launchOptions,
				...(browserName === 'chromium' ? { channel: 'chromium' } : {}),
			}
		);
		const page = await context.newPage();
		page.on('console', async (message) => {
			if (message.type() !== 'error') return;
			for (const arg of message.args()) {
				// Preserve caught startup errors: otherwise the trace only records "Error"
				// while the SDK waits for an API that the failed document never exposes.
				const detail = await arg
					.evaluate((value) =>
						value instanceof Error
							? { message: value.message, stack: value.stack }
							: String(value)
					)
					.catch(() => message.text());
				console.error('Runtime console:', detail);
			}
		});

		const scope = `assigned-${crypto.randomUUID()}`;
		const siteA = `site-a-${crypto.randomUUID()}`;
		const siteB = `site-b-${crypto.randomUUID()}`;
		const siteAPath = joinPaths('/sites', siteA);
		const siteBPath = joinPaths('/sites', siteB);
		const victimMarkerPath = joinPaths(siteBPath, 'marker.txt');
		try {
			await page.goto(appOrigin + '/manifest.json');
			await page.evaluate(
				async ({ appOrigin, scope, siteA, siteB, siteAPath }) => {
					const sites = await (
						await navigator.storage.getDirectory()
					).getDirectoryHandle('sites', { create: true });
					for (const [name, marker] of [
						[siteA, 'assigned site A'],
						[siteB, 'private site B'],
					]) {
						const directory = await sites.getDirectoryHandle(name, {
							create: true,
						});
						for (const [fileName, contents] of [
							['marker.txt', marker],
							['index.php', '<?php echo "Assigned PHP site";'],
						]) {
							const file = await directory.getFileHandle(
								fileName,
								{ create: true }
							);
							const writer = await file.createWritable();
							await writer.write(contents);
							await writer.close();
						}
					}
					const { startPlaygroundWebForApp } = await import(
						appOrigin + '/client/index.js'
					);
					const iframe = document.createElement('iframe');
					iframe.id = 'assigned-runtime';
					document.body.append(iframe);
					const client = await startPlaygroundWebForApp({
						iframe,
						remoteUrl: appOrigin + '/remote.html',
						workerMode: 'shared',
						scope,
						wordpressInstallMode: 'do-not-attempt-installing',
						blueprint: {
							preferredVersions: { php: '8.3', wp: false },
							steps: [],
						},
						mounts: [
							{
								mountpoint: '/wordpress',
								device: {
									type: 'opfs',
									path: siteAPath,
								},
								initialSyncDirection: 'opfs-to-memfs',
							},
						],
					});
					(window as any).assignedClient = client;
					if (
						(await client.readFileAsText(
							'/wordpress/marker.txt'
						)) !== 'assigned site A'
					)
						throw new Error('Assigned site did not mount');
					await client.writeFile(
						'/wordpress/marker.txt',
						'private app write'
					);
					await client.flushOpfs('/wordpress');
					await client.goTo('/');
				},
				{ appOrigin, scope, siteA, siteB, siteAPath }
			);

			const remote = (await (await page
				.locator('#assigned-runtime')
				.elementHandle())!.contentFrame())!;
			const wordpress = (await (await remote
				.locator('#wp')
				.elementHandle())!.contentFrame())!;
			await expect(wordpress.locator('body')).toContainText(
				'Assigned PHP site'
			);
			expect(new URL(wordpress.url()).origin).toBe(wordPressOrigin);
			expect(new URL(remote.url()).pathname).toContain(
				'/app-runtime.html'
			);
			const workerUrls = await remote.evaluate((scope) => {
				const identity = JSON.parse(
					localStorage.getItem(`playground:shared-worker:${scope}`)!
				);
				const entry = document.querySelector<HTMLScriptElement>(
					'script[type="module"][src]'
				)!;
				return {
					actual: identity.url,
					expected: new URL(
						'../shared-playground-worker.js',
						entry.src
					).pathname,
				};
			}, scope);
			expect(new URL(workerUrls.actual).pathname).toBe(
				workerUrls.expected
			);

			// Run the attack from the actual sandbox-origin PHP document, with the same
			// top-level site/storage partition as the saved sites. No RPC or SDK mocks.
			await wordpress.evaluate((origin) => {
				const iframe = document.createElement('iframe');
				iframe.id = 'public-runtime';
				iframe.src = origin + '/remote.html?access=app&trusted=1';
				document.body.append(iframe);
			}, appOrigin);
			const rogue = (await (await wordpress
				.locator('#public-runtime')
				.elementHandle())!.contentFrame())!;
			await rogue.waitForFunction(
				() => Boolean((window as any).playground),
				undefined,
				// Startup may perform its one bounded reload to acquire worker control.
				{ polling: 100, timeout: 60000 }
			);
			const results = await wordpress.evaluate(
				async ({ origin, siteAPath, siteBPath, victimMarkerPath }) => {
					const target =
						document.querySelector<HTMLIFrameElement>(
							'#public-runtime'
						)!.contentWindow!;
					const id = crypto.randomUUID();
					const port = await new Promise<MessagePort>(
						(resolve, reject) => {
							const timeout = setTimeout(() => {
								window.removeEventListener('message', receive);
								reject(new Error('Public RPC did not connect'));
							}, 15000);
							function receive(event: MessageEvent) {
								if (
									event.source !== target ||
									event.origin !== origin ||
									event.data?.id !== id
								)
									return;
								clearTimeout(timeout);
								window.removeEventListener('message', receive);
								if (!(event.data.value instanceof MessagePort))
									reject(new Error('Missing public port'));
								else resolve(event.data.value);
							}
							window.addEventListener('message', receive);
							target.postMessage(
								{ id, type: 'ENDPOINT' },
								origin
							);
						}
					);
					port.start();
					function invoke(
						path: string[],
						args: unknown[],
						type: 'APPLY' | 'GET' | 'SET' = 'APPLY'
					) {
						return new Promise<any>((resolve, reject) => {
							const id = crypto.randomUUID();
							const timeout = setTimeout(() => {
								port.removeEventListener('message', receive);
								reject(new Error('Public RPC did not reply'));
							}, 15000);
							function receive(event: MessageEvent) {
								if (event.data.id !== id) return;
								clearTimeout(timeout);
								port.removeEventListener('message', receive);
								resolve(event.data);
							}
							port.addEventListener('message', receive);
							port.postMessage({
								id,
								type,
								path,
								argumentList: args.map((value) => ({
									type: 'RAW',
									value,
								})),
								...(type === 'SET'
									? { value: { type: 'RAW', value: args[0] } }
									: {}),
							});
						});
					}
					try {
						const rejected: boolean[] = [];
						for (const path of [siteAPath, siteBPath]) {
							const mount = {
								mountpoint: '/wordpress',
								device: {
									type: 'opfs',
									path,
								},
								initialSyncDirection: 'opfs-to-memfs',
							};
							const startup = await invoke(
								['boot'],
								[
									{
										scope: 'rogue',
										mounts: [mount],
										phpVersion: '8.3',
										withNetworking: false,
									},
								]
							);
							rejected.push(
								startup.name === 'throw' &&
									JSON.stringify(startup).includes(
										'private app runtime connection'
									)
							);
							for (const path of [
								['mountOpfs'],
								['mountOpfsIntoPhp'],
								['__internal_getPHP'],
								['getRequestHandler'],
								['setPrimaryPHP'],
								['beginSharedBoot'],
								['shutdownSharedRuntime'],
								['opfsMounts', '/wordpress'],
							]) {
								const member = await invoke(
									[path[0]],
									[],
									'GET'
								);
								if (member.value instanceof MessagePort)
									member.value.close();
								rejected.push(
									member.type === 'RAW' &&
										member.value === undefined
								);
								const result = await invoke(path, [mount]);
								rejected.push(result.name === 'throw');
							}
						}
						const tamper = await invoke(['boot'], [null], 'SET');
						rejected.push(tamper.name === 'throw');
						const boot = await invoke(
							['boot'],
							[
								{
									scope: 'rogue-' + crypto.randomUUID(),
									phpVersion: '8.3',
									wpVersion: '6.9',
									wordpressInstallMode:
										'do-not-attempt-installing',
									withNetworking: false,
								},
							]
						);
						if (boot.name === 'throw')
							throw new Error(JSON.stringify(boot));
						const seesAssigned = (
							await invoke(
								['fileExists'],
								['/wordpress/marker.txt']
							)
						).value;
						const seesVictim = (
							await invoke(['fileExists'], [victimMarkerPath])
						).value;
						await invoke(
							['writeFile'],
							['/wordpress/marker.txt', 'public temporary write']
						);
						const ownBytes = (
							await invoke(
								['readFileAsText'],
								['/wordpress/marker.txt']
							)
						).value;
						// Identical names inside MEMFS still confer no browser-storage authority.
						await invoke(['mkdirTree'], [siteBPath]);
						await invoke(
							['writeFile'],
							[victimMarkerPath, 'attempted overwrite']
						);
						await invoke(['unlink'], [victimMarkerPath]);

						return { rejected, seesAssigned, seesVictim, ownBytes };
					} finally {
						port.close();
					}
				},
				{ origin: appOrigin, siteAPath, siteBPath, victimMarkerPath }
			);
			expect(results.rejected.every(Boolean)).toBe(true);
			expect(results.seesAssigned).toBe(false);
			expect(results.seesVictim).toBe(false);
			expect(results.ownBytes).toBe('public temporary write');

			// Both privileged entry navigation and shared flags on the public entry must
			// fail before acquiring a running site's worker, even with its exact scope.
			for (const entry of ['app-runtime.html', 'remote.html']) {
				await wordpress.evaluate(
					({ origin, entry, scope }) => {
						const iframe = document.createElement('iframe');
						iframe.id = 'forbidden-runtime';
						iframe.src = `${origin}/${entry}?shared-worker=1&scope=${encodeURIComponent(scope)}`;
						document.body.append(iframe);
					},
					{ origin: appOrigin, entry, scope }
				);
				const forbidden = (await (await wordpress
					.locator('#forbidden-runtime')
					.elementHandle())!.contentFrame())!;
				await forbidden.waitForFunction(
					() => document.body.classList.contains('has-error'),
					undefined,
					{ polling: 100, timeout: 30000 }
				);
				expect(
					await forbidden.evaluate(() =>
						Boolean((window as any).playground)
					)
				).toBe(false);
				await wordpress
					.locator('#forbidden-runtime')
					.evaluate((element) => element.remove());
			}

			// Legitimate app tabs still join the same initialized shared runtime.
			const trustedBytes = await page.evaluate(
				async ({ origin, scope }) => {
					const { startPlaygroundWebForApp } = await import(
						origin + '/client/index.js'
					);
					const iframe = document.createElement('iframe');
					document.body.append(iframe);
					const client = await startPlaygroundWebForApp({
						iframe,
						remoteUrl: origin + '/remote.html',
						workerMode: 'shared',
						scope,
						wordpressInstallMode: 'do-not-attempt-installing',
						blueprint: {
							preferredVersions: { php: '8.3', wp: false },
							steps: [],
						},
					});
					return await client.readFileAsText('/wordpress/marker.txt');
				},
				{ origin: appOrigin, scope }
			);
			expect(trustedBytes).toBe('private app write');
			const stored = await page.evaluate(
				async ({ siteA, siteB }) => {
					const sites = await (
						await navigator.storage.getDirectory()
					).getDirectoryHandle('sites');
					const values: string[] = [];
					for (const site of [siteA, siteB])
						values.push(
							await (
								await (
									await sites.getDirectoryHandle(site)
								).getFileHandle('marker.txt')
							)
								.getFile()
								.then((file) => file.text())
						);
					return values;
				},
				{ siteA, siteB }
			);
			expect(stored).toEqual(['private app write', 'private site B']);
		} finally {
			try {
				await page.evaluate(async () => {
					await (
						window as any
					).assignedClient?.shutdownSharedRuntime();
				});
			} finally {
				await context.close();
			}
		}
	}
);
