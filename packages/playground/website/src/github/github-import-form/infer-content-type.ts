import type { ContentType } from '../import-from-github';

export function inferContentType(
	files: Array<{ name: string }>
): ContentType | undefined {
	if (files.some(({ name }) => ['theme.json', 'style.css'].includes(name))) {
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
