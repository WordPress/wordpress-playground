import { describe, expect, it } from 'vitest';
import {
	buildPlaygroundAnnotationMetadata,
	serializeAnnotationMetadata,
} from './oai-annotations';

describe('serializeAnnotationMetadata', () => {
	it('serializes flat primitive and null values while omitting undefined entries', () => {
		const json = serializeAnnotationMetadata({
			siteSlug: 'my-site',
			wpVersion: '6.8',
			phpVersion: undefined,
			networking: true,
			currentUrl: null,
		});

		expect(JSON.parse(json)).toEqual({
			siteSlug: 'my-site',
			wpVersion: '6.8',
			networking: true,
			currentUrl: null,
		});
	});
	it('keeps supported strings when another value exceeds the browser limit', () => {
		const metadata = JSON.parse(
			serializeAnnotationMetadata({
				currentUrl: '/' + 'a'.repeat(256),
				siteSlug: 'a'.repeat(256),
			})
		);

		expect(metadata).toEqual({ siteSlug: 'a'.repeat(256) });
	});

	it('limits the serialized object by UTF-8 bytes', () => {
		const json = serializeAnnotationMetadata({
			first: '界'.repeat(256),
			second: '界'.repeat(256),
			third: '界'.repeat(256),
			activeDockPane: 'settings',
		});

		expect(new TextEncoder().encode(json).byteLength).toBeLessThanOrEqual(
			2048
		);
		expect(JSON.parse(json)).toEqual({
			first: '界'.repeat(256),
			second: '界'.repeat(256),
			activeDockPane: 'settings',
		});
	});

	it('limits metadata to six properties even when their values are null', () => {
		const json = serializeAnnotationMetadata({
			one: null,
			two: null,
			three: null,
			four: null,
			five: null,
			six: null,
			seven: null,
		});

		expect(Object.keys(JSON.parse(json))).toHaveLength(6);
	});
});

describe('buildPlaygroundAnnotationMetadata', () => {
	it('builds flat site context metadata when active site and client are present', () => {
		const json = buildPlaygroundAnnotationMetadata({
			siteSlug: 'cool-blog',
			storage: 'opfs',
			wpVersion: '6.8',
			phpVersion: '8.4',
			currentUrl: '/wp-admin/',
			activeDockPane: 'blueprint',
		});

		expect(JSON.parse(json)).toEqual({
			siteSlug: 'cool-blog',
			storage: 'opfs',
			wpVersion: '6.8',
			phpVersion: '8.4',
			currentUrl: '/wp-admin/',
			activeDockPane: 'blueprint',
		});
	});

	it('normalizes missing boot state values to null so annotation metadata stays valid flat JSON', () => {
		const json = buildPlaygroundAnnotationMetadata({});

		expect(JSON.parse(json)).toEqual({
			siteSlug: null,
			storage: null,
			wpVersion: null,
			phpVersion: null,
			currentUrl: null,
			activeDockPane: null,
		});
	});
});
