import { UniversalPHP } from '@php-wasm/universal';

/** @ts-ignore */
import transportFetch from './wp-content/mu-plugins/includes/requests_transport_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './wp-content/mu-plugins/includes/requests_transport_dummy.php?raw';
/** @ts-ignore */
import addRequests from './wp-content/mu-plugins/add_requests_transport.php?raw';
/** @ts-ignore */
import showAdminCredentialsOnWpLogin from './wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php?raw';

import { DOCROOT } from '../config';

export function applyWebWordPressPatches(php: UniversalPHP) {
	const patch = new WordPressPatcher(php, DOCROOT);

	patch.replaceRequestsTransports();
	patch.addMissingSvgs();
}

class WordPressPatcher {
	php: UniversalPHP;
	wordpressPath: string;

	constructor(php: UniversalPHP, wordpressPath: string) {
		this.php = php;
		this.wordpressPath = wordpressPath;
	}

	async replaceRequestsTransports() {
		await updateFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			(contents) => `${contents} define('USE_FETCH_FOR_REQUESTS', false);`
		);

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			`${this.wordpressPath}/wp-includes/Requests/Transport/fsockopen.php`,
			`${this.wordpressPath}/wp-includes/Requests/Transport/cURL.php`,
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!(await this.php.fileExists(transport))) {
				continue;
			}
			await updateFile(this.php, transport, (contents) =>
				contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				)
			);
		}

		// Add fetch and dummy transports for HTTP requests
		await this.php.mkdirTree(
			`${this.wordpressPath}/wp-content/mu-plugins/includes`
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/includes/requests_transport_fetch.php`,
			transportFetch
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/includes/requests_transport_dummy.php`,
			transportDummy
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/add_requests_transport.php`,
			addRequests
		);

		// Various tweaks
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php`,
			showAdminCredentialsOnWpLogin
		);
	}

	async addMissingSvgs() {
		// @TODO: use only on the web version, or not even there – just include these
		// in WordPress build:
		this.php.mkdirTree(`${this.wordpressPath}/wp-admin/images`);
		const missingSvgs = [
			`${this.wordpressPath}/wp-admin/images/about-header-about.svg`,
			`${this.wordpressPath}/wp-admin/images/dashboard-background.svg`,
		];
		for (const missingSvg of missingSvgs) {
			if (!(await this.php.fileExists(missingSvg))) {
				await this.php.writeFile(missingSvg, '');
			}
		}
	}
}

type PatchFileCallback = (contents: string) => string | Uint8Array;
export async function updateFile(
	php: UniversalPHP,
	path: string,
	callback: PatchFileCallback
) {
	await php.writeFile(path, callback(await php.readFileAsText(path)));
}
