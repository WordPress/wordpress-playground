export async function getV2Runner(): Promise<File> {
	/**
	 * Dynamically read the file on demand.
	 *
	 * In production, this is encoded as base64 which increases the file size by ~30%. This is
	 * not ideal, but there's no other standard solution for shipping static files with isomorphic
	 * npm CJS+ESM packages so this will have to do until a better solution emerges.
	 */
	const blueprintsPharBytes = // @ts-ignore
		(await import('../../../blueprints.phar?base64')).default;

	return new File([blueprintsPharBytes], `blueprints.phar`, {
		type: 'application/zip',
	});
}
