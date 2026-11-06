import { formatAddress, replaceCidReferences } from './mail-display';

describe('replaceCidReferences', () => {
	it('replaces a content id without corrupting a longer one sharing its prefix', () => {
		const html = '<img src="cid:1"><img src="cid:12">';
		expect(
			replaceCidReferences(html, [
				{ contentId: '1', url: 'blob:foo' },
				{ contentId: '12', url: 'blob:bar' },
			])
		).toBe('<img src="blob:foo"><img src="blob:bar">');
	});

	it('strips angle brackets and whitespace from content ids', () => {
		expect(
			replaceCidReferences('<img src="cid:foo">', [
				{ contentId: ' <foo> ', url: 'blob:bar' },
			])
		).toBe('<img src="blob:bar">');
	});

	it('ignores references missing a content id or a url', () => {
		const html = '<img src="cid:foo">';
		expect(
			replaceCidReferences(html, [
				{ url: 'blob:bar' },
				{ contentId: 'foo' },
			])
		).toBe(html);
	});
});

describe('formatAddress', () => {
	it('formats a group as its name followed by its members', () => {
		expect(
			formatAddress({
				name: 'foo',
				group: [
					{ name: 'bar', address: 'bar@example.com' },
					{ name: '', address: 'baz@example.com' },
				],
			})
		).toBe('foo: bar <bar@example.com>, baz@example.com');
	});

	it('formats an empty group as its name alone', () => {
		expect(formatAddress({ name: 'foo', group: [] })).toBe('foo');
	});
});
