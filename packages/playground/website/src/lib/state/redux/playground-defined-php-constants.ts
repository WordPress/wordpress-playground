import type { PHPConstants } from '@wp-playground/blueprints';
import type { PlaygroundClient } from '@wp-playground/remote';

/**
 * Returns constants registered through Playground's live PHP API.
 *
 * Calls to `playground.defineConstant()` are persisted in consts.json after the
 * iframe has already booted. Examples include `PLAYGROUND_AUTO_LOGIN_AS_USER`
 * from the login step, `WPLANG` from the language step, and caller-defined
 * constants such as `WP_DEBUG`. Saved sites need to replay them on reload, but
 * storing them in `runtimeConfiguration` would change the running iframe's boot
 * fingerprint and force an unnecessary reboot.
 */
export async function getPlaygroundDefinedPHPConstants(
	playground: PlaygroundClient
): Promise<PHPConstants> {
	const constantsPath = '/internal/shared/consts.json';
	if (!(await playground.fileExists(constantsPath))) {
		return {};
	}
	return JSON.parse(await playground.readFileAsText(constantsPath));
}
