import { getWpCliCommandError, stripWpPrefix } from './wp-cli-command';

describe('stripWpPrefix', () => {
	it.each([
		['wp option get blogname', 'option get blogname'],
		['$ wp option get blogname', 'option get blogname'],
		['  $ wp option get blogname  ', 'option get blogname'],
		['wp', ''],
		['option get blogname', 'option get blogname'],
		['wpackagist list', 'wpackagist list'],
	])('normalizes %s', (command, expected) => {
		expect(stripWpPrefix(command)).toBe(expected);
	});
});

describe('getWpCliCommandError', () => {
	it.each([
		['wp shell', 'wp shell is not supported'],
		['wp server', 'wp server is not supported'],
		['wp --path=/wordpress shell', 'wp shell is not supported'],
		['wp --path /wordpress shell', 'wp shell is not supported'],
	])('rejects %s', (command, expected) => {
		expect(getWpCliCommandError(command)).toContain(expected);
	});

	it.each([
		'wp option get blogname',
		'wp option set blogname',
		'wp option set blogname Playground',
		'wp --debug option list',
	])('allows %s', (command) => {
		expect(getWpCliCommandError(command)).toBeUndefined();
	});
});
