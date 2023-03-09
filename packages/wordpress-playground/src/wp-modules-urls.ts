// @ts-ignore
import wp59 from './wordpress/wp-5.9.js?url';
// @ts-ignore
import wp60 from './wordpress/wp-6.0.js?url';
// @ts-ignore
import wp61 from './wordpress/wp-6.1.js?url';
// @ts-ignore
import wpNightly from './wordpress/wp-nightly.js?url';

export const urls = {
	'5_9': wp59,
	'6_0': wp60,
	'6_1': wp61,
	nightly: wpNightly,
};

export function getWordPressModuleUrl(version) {
	if (!(version in urls)) {
		throw new Error(`Unsupported WordPress module: ${version}`);
	}
	return urls[version];
}
