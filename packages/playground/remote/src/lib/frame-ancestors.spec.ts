import { describe, expect, it } from 'vitest';
import { getFrameAncestors } from './frame-ancestors';

const root = 'https://playground.example';
const wordpress = 'https://wp.playground.example';

describe('trusted document framing policy', () => {
	it('allows normal referrers and explicit origins for all external ancestors', () => {
		const url = new URL('/remote.html', root);
		url.searchParams.append('embedder-origin', 'https://outer.example');
		url.searchParams.append('embedder-origin', 'https://inner.example');
		expect(
			getFrameAncestors(url, 'https://inner.example/article', wordpress)
		).toBe(
			"frame-ancestors 'self' https://outer.example https://inner.example"
		);
	});

	it.each([
		wordpress,
		wordpress + '/scope:example/',
		'http://wp.playground.example',
		'http://wp.playground.example:443',
		'https://wp.playground.example:9443',
		'https://user:password@wp.playground.example',
		'data:text/html,test',
		'null',
		'https://*.example',
		'https://example.com;frame-ancestors',
		"https://example.com'",
		'https://example.com,https:',
		"'none'; frame-ancestors *",
	])('never grants framing permission for %s', (value) => {
		const url = new URL('/api.html', root);
		url.searchParams.append('embedder-origin', value);
		expect(getFrameAncestors(url, value, wordpress)).toBe(
			"frame-ancestors 'self'"
		);
	});

	it('keeps WordPress excluded when an external origin is declared alongside it', () => {
		const url = new URL('/api.html', root);
		url.searchParams.append('embedder-origin', wordpress);
		url.searchParams.append('embedder-origin', 'https://external.example');
		expect(getFrameAncestors(url, wordpress, wordpress)).toBe(
			"frame-ancestors 'self' https://external.example"
		);
	});

	it('fails closed without either an explicit origin or a referrer', () => {
		expect(
			getFrameAncestors(new URL('/api.html', root), '', wordpress)
		).toBe("frame-ancestors 'self'");
	});
});
