describe('addRemoteOrigin', () => {
	let addRemoteOrigin: (origin: string) => void;
	let getRuntimeRemoteOrigins: () => readonly string[];

	beforeEach(async () => {
		// Reset the module so each test starts with an empty registry.
		vi.resetModules();
		({ addRemoteOrigin, getRuntimeRemoteOrigins } =
			await import('./runtime-remote-origins'));
	});

	describe('valid origins', () => {
		it('should accept a basic https origin', () => {
			addRemoteOrigin('https://example.com');
			expect(getRuntimeRemoteOrigins()).toEqual(['https://example.com']);
		});

		it('should accept an http origin', () => {
			addRemoteOrigin('http://example.com');
			expect(getRuntimeRemoteOrigins()).toEqual(['http://example.com']);
		});

		it('should accept an origin with a non-default port', () => {
			addRemoteOrigin('http://localhost:5401');
			expect(getRuntimeRemoteOrigins()).toEqual([
				'http://localhost:5401',
			]);
		});

		it('should accept a bracketed IPv6 origin', () => {
			addRemoteOrigin('http://[::1]:8080');
			expect(getRuntimeRemoteOrigins()).toEqual(['http://[::1]:8080']);
		});

		it('should accept a punycode host', () => {
			addRemoteOrigin('https://xn--exmple-cua.com');
			expect(getRuntimeRemoteOrigins()).toEqual([
				'https://xn--exmple-cua.com',
			]);
		});
	});

	describe('invalid origins', () => {
		it('should reject an empty string', () => {
			expect(() => addRemoteOrigin('')).toThrow("Invalid origin: ''");
		});

		it('should reject an unparseable string', () => {
			expect(() => addRemoteOrigin('not a url')).toThrow(
				"Invalid origin: 'not a url'"
			);
		});

		it('should reject an origin with a path', () => {
			expect(() => addRemoteOrigin('https://example.com/path')).toThrow(
				"Invalid origin: 'https://example.com/path'"
			);
		});

		it('should reject an origin with a trailing slash', () => {
			expect(() => addRemoteOrigin('https://example.com/')).toThrow(
				"Invalid origin: 'https://example.com/'"
			);
		});

		it('should reject an origin with a query string', () => {
			expect(() => addRemoteOrigin('https://example.com?x=1')).toThrow(
				"Invalid origin: 'https://example.com?x=1'"
			);
		});

		it('should reject an origin with a fragment', () => {
			expect(() => addRemoteOrigin('https://example.com#frag')).toThrow(
				"Invalid origin: 'https://example.com#frag'"
			);
		});

		it("should reject an origin with the scheme's default port specified", () => {
			// `new URL('https://example.com:443').href === 'https://example.com/'`,
			// so the round-trip strict-equality check rejects the input.
			expect(() => addRemoteOrigin('https://example.com:443')).toThrow(
				"Invalid origin: 'https://example.com:443'"
			);
		});

		it('should reject an origin with an uppercase scheme', () => {
			// The URL parser normalizes the scheme to lowercase, so the
			// round-trip strict-equality check rejects upper-case input.
			expect(() => addRemoteOrigin('HTTPS://example.com')).toThrow(
				"Invalid origin: 'HTTPS://example.com'"
			);
		});

		it('should reject an origin with a non-ASCII host', () => {
			// IDN hosts must be supplied in punycode form; otherwise the
			// URL parser normalizes the host and the round-trip check fails.
			expect(() => addRemoteOrigin('https://exämple.com')).toThrow(
				"Invalid origin: 'https://exämple.com'"
			);
		});

		it('should reject an origin with userinfo', () => {
			// `URL.origin` strips userinfo, so an origin with userinfo can
			// never match the iframe's `url.origin` at validation time.
			expect(() =>
				addRemoteOrigin('https://user:pass@example.com')
			).toThrow("Invalid origin: 'https://user:pass@example.com'");
		});

		it('should reject a `ws://` origin', () => {
			expect(() => addRemoteOrigin('ws://example.com')).toThrow(
				"Invalid origin: 'ws://example.com'"
			);
		});

		it('should reject a `file://` origin', () => {
			expect(() => addRemoteOrigin('file:///tmp/x')).toThrow(
				"Invalid origin: 'file:///tmp/x'"
			);
		});

		it('should reject a `data:` URL', () => {
			expect(() => addRemoteOrigin('data:text/plain,hi')).toThrow(
				"Invalid origin: 'data:text/plain,hi'"
			);
		});
	});

	describe('accumulation', () => {
		it('should accumulate across calls in insertion order', () => {
			addRemoteOrigin('https://a.example.com');
			addRemoteOrigin('https://b.example.com');
			addRemoteOrigin('https://c.example.com');
			expect(getRuntimeRemoteOrigins()).toEqual([
				'https://a.example.com',
				'https://b.example.com',
				'https://c.example.com',
			]);
		});

		it('should not deduplicate when the same origin is added twice', () => {
			addRemoteOrigin('https://example.com');
			addRemoteOrigin('https://example.com');
			expect(getRuntimeRemoteOrigins()).toEqual([
				'https://example.com',
				'https://example.com',
			]);
		});

		it('should not register an origin when validation throws', () => {
			expect(() => addRemoteOrigin('not a url')).toThrow();
			expect(getRuntimeRemoteOrigins()).toEqual([]);
		});

		it('should preserve previously registered origins when a later call is rejected', () => {
			addRemoteOrigin('https://first.example.com');
			expect(() => addRemoteOrigin('not a url')).toThrow();
			expect(getRuntimeRemoteOrigins()).toEqual([
				'https://first.example.com',
			]);
		});
	});
});
