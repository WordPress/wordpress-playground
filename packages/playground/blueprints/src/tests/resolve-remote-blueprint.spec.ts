import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { resolveRemoteBlueprint } from '../lib/resolve-remote-blueprint';

it('rejects Blueprint ZIP entries outside the bundle root', async () => {
	const zip = await createZipBuffer({
		'../blueprint.json': JSON.stringify({ steps: [] }),
	});

	await expect(
		resolveRemoteBlueprint('https://example.com/blueprint.zip', {
			fetch: async () => new Response(zip),
		})
	).rejects.toThrow('Unsafe Blueprint ZIP entry path: ../blueprint.json');
});

it('loads Blueprint ZIPs with blueprint.json inside one directory', async () => {
	const zip = await createZipBuffer({
		'bundle/blueprint.json': JSON.stringify({ steps: [] }),
		'bundle/resource.txt': 'resource',
	});

	const bundle = await resolveRemoteBlueprint(
		'https://example.com/blueprint.zip',
		{
			fetch: async () => new Response(zip),
		}
	);

	await expect(
		bundle.read('resource.txt').then((file) => file.text())
	).resolves.toBe('resource');
});

async function createZipBuffer(entries: Record<string, string>) {
	const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
	for (const [path, content] of Object.entries(entries)) {
		await zipWriter.add(path, new TextReader(content));
	}
	return await zipWriter.close();
}
