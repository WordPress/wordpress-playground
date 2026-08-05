import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { getDirectoryNameForSlug } from '../../src/lib/state/opfs/opfs-site-path';
import { test, expect } from '../playground-fixtures';

/**
 * This test isolates the public saved-site export API from Playground site creation:
 *
 * 1. Load a lightweight same-origin page without booting the full Playground.
 * 2. Seed a minimal, uniquely identified saved site directly in the origin's OPFS bucket.
 * 3. Load the public client and same-origin api.html in a sandboxed iframe.
 * 4. Export that slug and verify its marker content is present in the returned ZIP.
 *
 * The marker proves that api.html read the seeded OPFS site through the public API.
 */
test('startPlaygroundAPI exports a saved OPFS site through api.html', async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		`This test relies on OPFS which isn't available in Playwright's flavor of ${browserName}.`
	);

	// Use a lightweight same-origin page without booting the full Playground.
	await page.goto('./manifest.json');

	const slug = `api-e2e-${crypto.randomUUID()}`;
	const directoryName = getDirectoryNameForSlug(slug);
	const markerPath = 'wp-content/api-e2e.txt';
	const markerContent = `Exported through api.html for ${slug}`;
	const zipBytes = await page.evaluate(
		async ({ slug, directoryName, markerContent }) => {
			const root = await navigator.storage.getDirectory();
			const sitesRoot = await root.getDirectoryHandle('sites', {
				create: true,
			});
			const siteDirectory = await sitesRoot.getDirectoryHandle(
				directoryName,
				{ create: true }
			);
			let iframe: HTMLIFrameElement | undefined;
			try {
				// Seed a minimal saved site so this test isolates the public export API contract.
				await writeFile(
					siteDirectory,
					'wp-runtime.json',
					JSON.stringify({
						slug,
						id: slug,
						name: 'API E2E Playground',
						storage: 'opfs',
						runtimeConfiguration: {
							phpVersion: '8.4',
							wpVersion: 'latest',
							intl: false,
							networking: true,
							extraLibraries: [],
							constants: {},
						},
						originalBlueprint: {},
						originalBlueprintSource: { type: 'none' },
					})
				);
				const wpContent = await siteDirectory.getDirectoryHandle(
					'wp-content',
					{ create: true }
				);
				await writeFile(wpContent, 'api-e2e.txt', markerContent);

				iframe = document.createElement('iframe');
				iframe.hidden = true;
				iframe.sandbox.add('allow-scripts');
				iframe.sandbox.add('allow-same-origin');
				document.body.appendChild(iframe);

				const clientUrl = new URL(
					'client/index.js',
					window.location.href
				).href;
				const { startPlaygroundAPI } = await import(clientUrl);
				const api = await startPlaygroundAPI({
					iframe,
					apiUrl: new URL('/api.html', window.location.origin).href,
				});
				const zip = await api.exportSavedSiteAsZip(slug);
				if (!zip) {
					throw new Error(`Saved site "${slug}" was not exported.`);
				}
				return Array.from(new Uint8Array(await zip.arrayBuffer()));
			} finally {
				iframe?.remove();
				await sitesRoot.removeEntry(directoryName, { recursive: true });
			}

			async function writeFile(
				directory: FileSystemDirectoryHandle,
				name: string,
				contents: string
			) {
				const file = await directory.getFileHandle(name, {
					create: true,
				});
				const writable = await file.createWritable();
				await writable.write(contents);
				await writable.close();
			}
		},
		{ slug, directoryName, markerContent }
	);

	const zipReader = new ZipReader(
		new BlobReader(new Blob([Uint8Array.from(zipBytes)]))
	);
	let exportedMarkerContent: string | undefined;
	try {
		const entries = await zipReader.getEntries();
		const markerEntry = entries.find(
			(entry) => entry.filename === markerPath
		);
		if (markerEntry) {
			exportedMarkerContent = await markerEntry.getData!(
				new TextWriter()
			);
		}
	} finally {
		await zipReader.close();
	}

	expect(exportedMarkerContent).toBe(markerContent);
});
