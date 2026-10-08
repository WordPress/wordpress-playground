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
});

describe('buildPlaygroundAnnotationMetadata', () => {
	it('builds flat site context metadata when active site and client are present', () => {
		const json = buildPlaygroundAnnotationMetadata({
			siteSlug: 'cool-blog',
			siteName: 'Cool Blog',
			storage: 'opfs',
			wpVersion: '6.8',
			phpVersion: '8.4',
			currentUrl: '/wp-admin/',
			activeDockPane: 'blueprint',
		});

		expect(JSON.parse(json)).toEqual({
			siteSlug: 'cool-blog',
			siteName: 'Cool Blog',
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
			siteName: null,
			storage: null,
			wpVersion: null,
			phpVersion: null,
			currentUrl: null,
			activeDockPane: null,
		});
	});
});
