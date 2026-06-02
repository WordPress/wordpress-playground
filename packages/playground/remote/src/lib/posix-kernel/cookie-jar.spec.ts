import { describe, expect, it } from 'vitest';
import { CookieJar } from './cookie-jar';

describe('CookieJar', () => {
	describe('serialize', () => {
		it('returns an empty string for an empty jar', () => {
			expect(new CookieJar().serialize()).toBe('');
		});

		it('renders a single cookie as `name=value`', () => {
			const jar = new CookieJar();
			jar.ingest('foo=bar');
			expect(jar.serialize()).toBe('foo=bar');
		});

		it('joins multiple cookies with `; `', () => {
			const jar = new CookieJar();
			jar.ingest('a=1');
			jar.ingest('b=2');
			expect(jar.serialize()).toBe('a=1; b=2');
		});
	});

	describe('ingest', () => {
		it('upserts existing cookie names', () => {
			const jar = new CookieJar();
			jar.ingest('foo=bar');
			jar.ingest('foo=baz');
			expect(jar.serialize()).toBe('foo=baz');
		});

		it('ignores raw values with no `=`', () => {
			const jar = new CookieJar();
			jar.ingest('justaname');
			expect(jar.serialize()).toBe('');
		});

		it('ignores blank inputs', () => {
			const jar = new CookieJar();
			jar.ingest('');
			jar.ingest('   ');
			expect(jar.serialize()).toBe('');
		});

		it('ignores Path / Domain / Secure / SameSite / HttpOnly attrs', () => {
			const jar = new CookieJar();
			jar.ingest(
				'wp_session=abc123; Path=/; Domain=.example.com; ' +
					'Secure; HttpOnly; SameSite=Lax'
			);
			expect(jar.serialize()).toBe('wp_session=abc123');
		});

		it('deletes the cookie when `Max-Age=0`', () => {
			const jar = new CookieJar();
			jar.ingest('foo=bar');
			jar.ingest('foo=bar; Max-Age=0');
			expect(jar.serialize()).toBe('');
		});

		it('deletes the cookie when `Max-Age` is negative', () => {
			const jar = new CookieJar();
			jar.ingest('foo=bar');
			jar.ingest('foo=bar; Max-Age=-1');
			expect(jar.serialize()).toBe('');
		});

		it('deletes the cookie when `Expires=` is in the past', () => {
			const jar = new CookieJar();
			jar.ingest('foo=bar');
			jar.ingest('foo=bar; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
			expect(jar.serialize()).toBe('');
		});

		it('keeps the cookie when `Expires=` is in the future', () => {
			const jar = new CookieJar();
			const future = new Date(Date.now() + 3_600_000).toUTCString();
			jar.ingest(`foo=bar; Expires=${future}`);
			expect(jar.serialize()).toBe('foo=bar');
		});
	});

	describe('ingestAll', () => {
		it('returns an empty array for undefined input', () => {
			const jar = new CookieJar();
			expect(jar.ingestAll(undefined)).toEqual([]);
			expect(jar.serialize()).toBe('');
		});

		it('returns an empty array for empty string input', () => {
			expect(new CookieJar().ingestAll('')).toEqual([]);
		});

		it('splits a comma-joined Set-Cookie header value', () => {
			const jar = new CookieJar();
			const out = jar.ingestAll('a=1, b=2');
			expect(out).toEqual(['a=1', 'b=2']);
			expect(jar.serialize()).toBe('a=1; b=2');
		});

		it('does NOT split on commas that live inside `Expires=`', () => {
			const jar = new CookieJar();
			const out = jar.ingestAll(
				'a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT, b=2'
			);
			expect(out).toEqual([
				'a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
				'b=2',
			]);
			expect(jar.serialize()).toBe('b=2');
		});

		it('splits a `\\n`-joined Set-Cookie header value', () => {
			const jar = new CookieJar();
			const out = jar.ingestAll('a=1\nb=2');
			expect(out).toEqual(['a=1', 'b=2']);
			expect(jar.serialize()).toBe('a=1; b=2');
		});

		it('handles the mixed `\\n` + safe-comma shape', () => {
			const jar = new CookieJar();
			const out = jar.ingestAll(
				'a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT\nb=2, c=3'
			);
			expect(out).toEqual([
				'a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
				'b=2',
				'c=3',
			]);
			expect(jar.serialize()).toBe('b=2; c=3');
		});
	});
});
