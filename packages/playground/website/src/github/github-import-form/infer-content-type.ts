import type { ContentType } from '../import-from-github';

export function inferContentType(
	files: Array<{ name: string }>
): ContentType | undefined {
	const names = new Set(files.map(({ name }) => name));
	if (
		names.has('theme.json') ||
		(names.has('style.css') && names.has('functions.php'))
	) {
		return 'theme';
	}
	if (
		files.some(({ name }) =>
			['plugins', 'themes', 'mu-plugins'].includes(name)
		)
	) {
		return 'wp-content';
	}
	if (files.some(({ name }) => name.endsWith('.php'))) {
		return 'plugin';
	}
}
