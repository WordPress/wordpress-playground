import {
	cloneRequest,
	getRequestHeaders,
	removeContentSecurityPolicyDirective,
} from './utils';

describe('cloneRequest', () => {
	it('should clone request headers', async () => {
		const request = new Request('http://localhost', {
			headers: {
				'Content-Type': 'text/plain',
				'X-Wp-Nonce': '123456',
			},
		});
		const cloned = await cloneRequest(request, {});
		expect(cloned.headers.get('content-type')).toBe('text/plain');
		expect(cloned.headers.get('x-wp-nonce')).toBe('123456');
	});
});

describe('getRequestHeaders', () => {
	it('should extract request headers', async () => {
		const request = new Request('http://localhost', {
			headers: {
				'Content-Type': 'text/plain',
				'X-Wp-Nonce': '123456',
			},
		});
		expect(getRequestHeaders(request)).toEqual({
			'content-type': 'text/plain',
			'x-wp-nonce': '123456',
		});
	});
});

describe('removeContentSecurityPolicyDirective', () => {
	it('should remove the specified directive from the middle of the Content-Security-Policy header value', () => {
		const cspHeader =
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self';";
		const directiveToRemove = 'frame-ancestors';
		const filteredCspHeader = removeContentSecurityPolicyDirective(
			directiveToRemove,
			cspHeader
		);
		expect(filteredCspHeader).toBe(
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
		);
	});

	it('should remove the specified directive from the beginning of the Content-Security-Policy header value', () => {
		const cspHeader =
			"frame-ancestors 'self'; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';";
		const directiveToRemove = 'frame-ancestors';
		const filteredCspHeader = removeContentSecurityPolicyDirective(
			directiveToRemove,
			cspHeader
		);
		expect(filteredCspHeader).toBe(
			" default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
		);
	});

	it('should remove the specified directive from the end of the Content-Security-Policy header value', () => {
		const cspHeader =
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self';";
		const directiveToRemove = 'frame-ancestors';
		const filteredCspHeader = removeContentSecurityPolicyDirective(
			directiveToRemove,
			cspHeader
		);
		expect(filteredCspHeader).toBe(
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
		);
	});

	it('should remove the specified directive from the Content-Security-Policy header value when there are multiple directives', () => {
		const cspHeader =
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; frame-ancestors 'self';";
		const directiveToRemove = 'frame-ancestors';
		const filteredCspHeader = removeContentSecurityPolicyDirective(
			directiveToRemove,
			cspHeader
		);
		expect(filteredCspHeader).toBe(
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
		);
	});

	it('should remove the specified directive when preceded by every type of ASCII whitespace', () => {
		const cspHeader =
			"default-src 'self';\u{9}\u{A}\u{C}\u{D}\u{20}frame-ancestors 'self';";
		const directiveToRemove = 'frame-ancestors';
		const filteredCspHeader = removeContentSecurityPolicyDirective(
			directiveToRemove,
			cspHeader
		);
		expect(filteredCspHeader).toBe("default-src 'self';");
	});

	it('should remove the specified directive when followed by every type of ASCII whitespace', () => {
		const cspHeader =
			"default-src 'self'; frame-ancestors\u{9}\u{A}\u{C}\u{D}\u{20}'self';";
		const directiveToRemove = 'frame-ancestors';
		const filteredCspHeader = removeContentSecurityPolicyDirective(
			directiveToRemove,
			cspHeader
		);
		expect(filteredCspHeader).toBe("default-src 'self';");
	});
});
