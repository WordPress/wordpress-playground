import type { BlueprintV1Declaration } from '@wp-playground/client';
import { InMemoryFilesystem } from '@wp-playground/storage';
import { collectBlueprintResources } from './resources';

afterEach(() => vi.unstubAllGlobals());

it('preserves bundled setup files and retains them across a second snapshot save', async () => {
	const setup: BlueprintV1Declaration = {
		steps: [
			{
				step: 'installPlugin',
				pluginData: { resource: 'bundled', path: './readymade.zip' },
			},
			{
				step: 'importWxr',
				file: { resource: 'bundled', path: './content.xml' },
			},
			{
				step: 'writeFile',
				path: '/tmp/content.xml',
				data: { resource: 'bundled', path: './content.xml' },
			},
		],
	};
	const bundle = new InMemoryFilesystem({
		'readymade.zip': new Uint8Array([80, 75, 3, 4]),
		'content.xml': '<rss>Saved content</rss>',
	});
	const first = await collectBlueprintResources(
		setup,
		bundle,
		'https://site.space.fast/',
		''
	);
	expect(first.files).toHaveLength(2);
	expect(first.blueprint.steps?.[0]).toMatchObject({
		pluginData: {
			resource: 'url',
			url: 'https://site.space.fast/_playground/resources/0/readymade.zip',
		},
	});
	expect(first.blueprint.steps?.[1]).toMatchObject({
		file: {
			resource: 'url',
			url: 'https://site.space.fast/_playground/resources/1/content.xml',
		},
	});
	expect(setup.steps?.[0]).toMatchObject({
		pluginData: { resource: 'bundled' },
	});
	const fetchMock = vi.fn(async (request: Request) => {
		const file = first.files.find(
			({ path }) => request.url === `https://site.space.fast/${path}`
		);
		if (!file) throw new Error(`Unexpected resource ${request.url}`);
		return new Response(file.data);
	});
	vi.stubGlobal('fetch', fetchMock);
	const second = await collectBlueprintResources(
		first.blueprint,
		undefined,
		'https://site.space.fast/',
		''
	);
	expect(second.blueprint).toEqual(first.blueprint);
	expect(fetchMock).toHaveBeenCalledTimes(2);
	for (let i = 0; i < first.files.length; i++) {
		expect(second.files[i].path).toBe(first.files[i].path);
		expect(await second.files[i].data.arrayBuffer()).toEqual(
			await first.files[i].data.arrayBuffer()
		);
	}
});
