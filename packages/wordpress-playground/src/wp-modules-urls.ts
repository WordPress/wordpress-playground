export function getWordPressModule(version) {
	switch (version) {
		case '5.9':
			return import('./wordpress/wp-5.9.js');
		case '6.0':
			return import('./wordpress/wp-6.0.js');
		case '6.1':
			return import('./wordpress/wp-6.1.js');
		case 'nightly':
			return import('./wordpress/wp-nightly.js');
	}
	throw new Error(`Unsupported WordPress module: ${version}`);
}
