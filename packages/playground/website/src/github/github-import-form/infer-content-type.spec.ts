import { inferContentType } from './infer-content-type';

describe('inferContentType', () => {
	it.each(['theme.json', 'style.css'])(
		'recognizes a theme from %s',
		(name) => {
			expect(
				inferContentType([{ name }, { name: 'functions.php' }])
			).toBe('theme');
		}
	);

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
