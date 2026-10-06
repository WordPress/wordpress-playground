import { describe, expect, it } from 'vitest';
import { InMemoryFilesystemBackend } from '@wp-playground/storage';
import { isSiteOrigin, snapshotOriginBlueprint } from './origin-isolation';

describe('Blueprint transfer to a fresh origin', () => {
	it('copies binary files and empty directories without retaining backend references', async () => {
		const source = new InMemoryFilesystemBackend({
			'/blueprint.json': new TextEncoder().encode('{}'),
		});
		await source.mkdir('/assets');
		await source.writeFile(
			'/assets/marker.bin',
			new Uint8Array([0, 128, 255])
		);
		await source.mkdir('/assets/empty');
		const snapshot = structuredClone(await snapshotOriginBlueprint(source));
		expect(snapshot).toEqual([
			{ path: '/blueprint.json', bytes: new TextEncoder().encode('{}') },
			{ path: '/assets', bytes: null },
			{
				path: '/assets/marker.bin',
				bytes: new Uint8Array([0, 128, 255]),
			},
			{ path: '/assets/empty', bytes: null },
		]);
		await source.writeFile('/assets/marker.bin', new Uint8Array([1]));
		expect(snapshot[2].bytes).toEqual(new Uint8Array([0, 128, 255]));
	});
});

// A hostname suffix alone would also trust the asset host or a different port.
// This classifier gates both incoming bridge requests and token protection.
describe('site origin boundary', () => {
	const base = 'http://playground.localhost:9400';
	it('accepts a sibling site origin with the same scheme and port', () => {
		expect(
			isSiteOrigin('http://site-aaaa.playground.localhost:9400', base)
		).toBe(true);
	});
	it.each([
		'http://playground.localhost:9400',
		'http://static.playground.localhost:9400',
		'http://site-aaaa.playground.localhost:9401',
		'https://site-aaaa.playground.localhost:9400',
		'http://site-aaaa.playground.localhost.example:9400',
		'http://user@site-aaaa.playground.localhost:9400',
		'http://site-aaaa.playground.localhost:9400/path',
		'null',
	])('rejects %s', (origin) => {
		expect(isSiteOrigin(origin, base)).toBe(false);
	});
});
