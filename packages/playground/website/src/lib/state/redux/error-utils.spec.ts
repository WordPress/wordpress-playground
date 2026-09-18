import { FirewallInterferenceError } from '@php-wasm/web-service-worker';
import {
	findDownloadErrorInCauseChain,
	findFirewallErrorInCauseChain,
} from './error-utils';

describe('findDownloadErrorInCauseChain', () => {
	it('should detect TypeError with "Failed to fetch"', () => {
		const error = new TypeError('Failed to fetch');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect TypeError with "Importing a module script failed"', () => {
		const error = new TypeError('Importing a module script failed.');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect "error loading dynamically imported module"', () => {
		const error = new TypeError(
			'error loading dynamically imported module: https://example.com/foo.js'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect Firefox "NetworkError when attempting to fetch"', () => {
		const error = new TypeError(
			'NetworkError when attempting to fetch resource.'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect Safari "Load failed"', () => {
		const error = new TypeError('Load failed');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect WebAssembly.CompileError', () => {
		const error = new WebAssembly.CompileError(
			'expected magic word 00 61 73 6d'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect CompileError via originalErrorClassName (Comlink)', () => {
		const error = new Error('expected magic word 00 61 73 6d');
		(error as any).originalErrorClassName = 'CompileError';
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect LinkError', () => {
		const error = new WebAssembly.LinkError(
			'import object field is not a Function'
		);
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should find download error nested in cause chain', () => {
		const downloadError = new TypeError('Failed to fetch');
		const wrapper = new Error('Boot failed', {
			cause: downloadError,
		});
		expect(findDownloadErrorInCauseChain(wrapper)).toBe(downloadError);
	});

	it('should find download error deeply nested in cause chain', () => {
		const downloadError = new TypeError('Failed to fetch');
		const mid = new Error('Step failed', {
			cause: downloadError,
		});
		const outer = new Error('Boot failed', { cause: mid });
		expect(findDownloadErrorInCauseChain(outer)).toBe(downloadError);
	});

	it('should return undefined for non-network errors', () => {
		const error = new Error('Something else went wrong');
		expect(findDownloadErrorInCauseChain(error)).toBeUndefined();
	});

	it('should return undefined for null/undefined', () => {
		expect(findDownloadErrorInCauseChain(null)).toBeUndefined();
		expect(findDownloadErrorInCauseChain(undefined)).toBeUndefined();
	});

	it('should return undefined for non-Error objects', () => {
		expect(
			findDownloadErrorInCauseChain('Failed to fetch')
		).toBeUndefined();
	});

	it('should be case-insensitive for message matching', () => {
		const error = new TypeError('FAILED TO FETCH');
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect LinkError via originalErrorClassName (Comlink)', () => {
		const error = new Error('import object field is not a Function');
		(error as any).originalErrorClassName = 'LinkError';
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should detect ResourceDownloadError by name', () => {
		const error = new Error(
			'Could not download "https://example.com/file.zip"'
		);
		error.name = 'ResourceDownloadError';
		expect(findDownloadErrorInCauseChain(error)).toBe(error);
	});

	it('should return the first matching error in the chain', () => {
		const deeper = new TypeError('Load failed');
		const shallower = new TypeError('Failed to fetch', {
			cause: deeper,
		});
		const outer = new Error('Boot failed', { cause: shallower });
		expect(findDownloadErrorInCauseChain(outer)).toBe(shallower);
	});

	it('should return undefined for an error with non-Error cause', () => {
		const error = new Error('Wrapper');
		(error as any).cause = 'not an error object';
		expect(findDownloadErrorInCauseChain(error)).toBeUndefined();
	});
});

describe('findFirewallErrorInCauseChain', () => {
	it('should detect FirewallInterferenceError via instanceof', () => {
		const error = new FirewallInterferenceError(
			'https://example.com',
			403,
			'Forbidden'
		);
		expect(findFirewallErrorInCauseChain(error)).toBe(error);
	});

	it('should detect FirewallInterferenceError by name property', () => {
		const error = new Error('Could not fetch https://example.com');
		error.name = 'FirewallInterferenceError';
		expect(findFirewallErrorInCauseChain(error)).toBe(error);
	});

	it('should find FirewallInterferenceError nested in cause chain', () => {
		const firewallError = new FirewallInterferenceError(
			'https://example.com',
			403,
			'Forbidden'
		);
		const wrapper = new Error('Boot failed', {
			cause: firewallError,
		});
		expect(findFirewallErrorInCauseChain(wrapper)).toBe(firewallError);
	});

	it('should find FirewallInterferenceError deeply nested', () => {
		const firewallError = new FirewallInterferenceError(
			'https://example.com',
			403,
			'Forbidden'
		);
		const mid = new Error('Step failed', { cause: firewallError });
		const outer = new Error('Boot failed', { cause: mid });
		expect(findFirewallErrorInCauseChain(outer)).toBe(firewallError);
	});

	it('should find by name when deeply nested', () => {
		const firewallError = new Error('Could not fetch');
		firewallError.name = 'FirewallInterferenceError';
		const mid = new Error('Step failed', { cause: firewallError });
		const outer = new Error('Boot failed', { cause: mid });
		expect(findFirewallErrorInCauseChain(outer)).toBe(firewallError);
	});

	it('should return undefined for non-firewall errors', () => {
		const error = new Error('Something else went wrong');
		expect(findFirewallErrorInCauseChain(error)).toBeUndefined();
	});

	it('should return undefined for null/undefined', () => {
		expect(findFirewallErrorInCauseChain(null)).toBeUndefined();
		expect(findFirewallErrorInCauseChain(undefined)).toBeUndefined();
	});

	it('should return undefined for non-Error objects', () => {
		expect(
			findFirewallErrorInCauseChain('FirewallInterferenceError')
		).toBeUndefined();
	});

	it('should not match errors with similar but different names', () => {
		const error = new Error('Some error');
		error.name = 'NotAFirewallInterferenceError';
		expect(findFirewallErrorInCauseChain(error)).toBeUndefined();
	});

	it('should not match errors that mention firewall in the message', () => {
		const error = new Error('firewall blocked the request');
		expect(findFirewallErrorInCauseChain(error)).toBeUndefined();
	});

	it('should return the first match when both instanceof and name matches exist in the chain', () => {
		const namedError = new Error('fake');
		namedError.name = 'FirewallInterferenceError';
		const realFirewall = new FirewallInterferenceError(
			'https://example.com',
			403,
			'Forbidden'
		);
		// Chain: outer → namedError → realFirewall
		// namedError is encountered first while walking the chain
		(realFirewall as any).cause = undefined;
		(namedError as any).cause = realFirewall;
		const outer = new Error('top', { cause: namedError });
		expect(findFirewallErrorInCauseChain(outer)).toBe(namedError);
	});
});
