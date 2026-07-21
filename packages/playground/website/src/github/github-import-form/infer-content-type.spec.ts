import { inferContentType } from './infer-content-type';

describe('inferContentType', () => {
	it('recognizes a theme from theme.json', () => {
		expect(inferContentType([{ name: 'theme.json' }])).toBe('theme');
	});

	it('recognizes a classic theme from style.css and functions.php', () => {
		expect(
			inferContentType([{ name: 'style.css' }, { name: 'functions.php' }])
		).toBe('theme');
	});

	it('does not mistake a plugin stylesheet for a theme', () => {
		expect(
			inferContentType([{ name: 'style.css' }, { name: 'plugin.php' }])
		).toBe('plugin');
	});

	it('recognizes a wp-content directory before its index.php file', () => {
		expect(
			inferContentType([
				{ name: 'index.php' },
				{ name: 'plugins' },
				{ name: 'themes' },
			])
		).toBe('wp-content');
	});

	it('recognizes a plugin from its PHP files', () => {
		expect(inferContentType([{ name: 'plugin.php' }])).toBe('plugin');
	});

	it('leaves an unknown directory unclassified', () => {
		expect(inferContentType([{ name: 'readme.md' }])).toBeUndefined();
	});
});
