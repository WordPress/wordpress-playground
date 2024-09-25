import { StepHandler } from '.';
import { writeFile } from './write-file';

/**
 * @inheritDoc installWpCli
 * @example
 *
 * <code>
 * {
 * 		"step": "installWpCli"
 * }
 * </code>
 */
export type InstallWpCliStep = {
	step: 'installWpCli';
};

/**
 * Installs WP-CLI.
 *
 * @param playground The playground client.
 */
export const installWpCli: StepHandler<InstallWpCliStep> = async (
	playground
) => {
	if (await playground.fileExists('/tmp/wp-cli.phar')) {
		return;
	}

	const wpCliPhar = await fetch(
		'https://playground.wordpress.net/wp-cli.phar'
	).then((r) => r.arrayBuffer());
	await writeFile(playground, {
		data: new Uint8Array(wpCliPhar),
		path: '/tmp/wp-cli.phar',
	});
};
