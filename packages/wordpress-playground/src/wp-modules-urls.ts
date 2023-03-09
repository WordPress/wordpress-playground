export function getWordPressModule(version) {
	switch (version) {
		case '5_9':
			return import('./wordpress/wp-5.9.js');
		case '6_0':
			return import('./wordpress/wp-6.0.js');
		case '6_1':
			return import('./wordpress/wp-6.1.js');
		case 'nightly':
			return import('./wordpress/wp-nightly.js');
	}
	throw new Error(`Unsupported WordPress module: ${version}`);
}
