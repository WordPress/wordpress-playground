export async function getV2Runner(): Promise<File> {
	let data = null;

	/**
	 * Avoid a static dependency for now.
	 *
	 * Playground.wordpress.net does not need to know about the new runner yet, and
	 * a static import would force it to download the v2 runner even when it's not needed.
	 * This breaks the offline mode as the static assets list is not yet updated to accommodate
	 * for the new .phar file.
	 */
	// @ts-ignore
	const v2_runner_url = (await import('../../public/blueprints.phar?url'))
		.default;

	/**
	 * Only load the v2 runner via node:fs when running in Node.js.
	 */
	if (typeof process !== 'undefined' && process.versions?.node) {
		let path = v2_runner_url;
		if (path.startsWith('/@fs/')) {
			path = path.slice('/@fs'.length);
		}
		if (path.startsWith('file://')) {
			path = path.slice('file://'.length);
		}

		const { readFile } = await import('node:fs/promises');
		data = await readFile(path);
	} else {
		const response = await fetch(v2_runner_url);
		data = await response.blob();
	}
	return new File([data], `blueprints.phar`, {
		type: 'application/zip',
	});
}
