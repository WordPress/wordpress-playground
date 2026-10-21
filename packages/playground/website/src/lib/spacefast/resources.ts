import type {
	BlueprintBundle,
	BlueprintV1Declaration,
} from '@wp-playground/client';
import { resolveRemoteBlueprint } from '@wp-playground/blueprints';
import { basename, joinPaths, normalizePath } from '@php-wasm/util';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import type { PublishedFile } from './api';
import { publicFileUrl, SOURCE_DIRECTORY } from './paths';

/** Keep setup dependencies available after moving a Blueprint to Spacefast. */
export async function collectBlueprintResources(
	blueprint: BlueprintV1Declaration,
	bundle: BlueprintBundle | undefined,
	publishedUrl: string,
	proxy: string,
	sourceUrl?: string
) {
	const base = new URL(publishedUrl);
	const resourceDirectory = joinPaths(SOURCE_DIRECTORY, 'resources');
	const resourceUrlPrefix = new URL(`${resourceDirectory}/`, base).href;
	const files: PublishedFile[] = [];
	const copied = new Map<string, string>();
	const fetchResource: typeof fetch = (input, init) =>
		fetchWithCorsProxy(
			input instanceof URL ? input.href : input,
			init,
			proxy
		);
	const setup = structuredClone(blueprint);
	await visit(setup);
	return { blueprint: setup, files };

	async function visit(value: unknown): Promise<void> {
		if (!value || typeof value !== 'object') return;
		const reference = value as Record<string, unknown>;
		const bundled =
			reference.resource === 'bundled' &&
			typeof reference.path === 'string';
		const hosted =
			reference.resource === 'url' &&
			typeof reference.url === 'string' &&
			reference.url.startsWith(resourceUrlPrefix);
		if (bundled || hosted) {
			const source = bundled
				? normalizePath(reference.path as string)
				: (reference.url as string);
			const key = `${bundled ? 'bundled' : 'url'}:${source}`;
			let url = copied.get(key);
			if (!url) {
				let data: Blob;
				if (bundled) {
					if (!bundle && sourceUrl) {
						bundle = await resolveRemoteBlueprint(sourceUrl, {
							fetch: fetchResource,
						});
					}
					if (!bundle)
						throw new Error(
							`Cannot save bundled Blueprint file ${source}: its source bundle is unavailable.`
						);
					data = new Blob([
						await (await bundle.read(source)).arrayBuffer(),
					]);
				} else {
					const response = await fetchResource(source, {
						credentials: 'omit',
					});
					if (!response.ok)
						throw new Error(
							`Could not preserve Blueprint resource ${source} (${response.status}).`
						);
					data = await response.blob();
				}
				const name = bundled
					? basename(source)
					: decodeURIComponent(basename(new URL(source).pathname));
				const path = joinPaths(
					resourceDirectory,
					String(files.length),
					name
				);
				url = publicFileUrl(path, base).href;
				files.push({ path, data });
				copied.set(key, url);
			}
			delete reference.path;
			reference.resource = 'url';
			reference.url = url;
			return;
		}
		for (const child of Object.values(value)) await visit(child);
	}
}
