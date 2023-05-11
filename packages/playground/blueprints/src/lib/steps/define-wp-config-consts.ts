import { StepHandler } from '.';
import { updateFile } from './common';

export interface DefineWpConfigConstsStep {
	step: 'defineWpConfigConsts';
	consts: Record<string, unknown>;
}

/**
 * Sets site URL of the WordPress installation.
 *
 * @param playground The playground client.
 * @param wpConfigConst
 */
export const defineWpConfigConsts: StepHandler<
	DefineWpConfigConstsStep
> = async (playground, { consts }) => {
	const documentRoot = await playground.documentRoot;
	await updateFile(
		playground,
		`${documentRoot}/playground-consts.json`,
		(contents) =>
			JSON.stringify({
				...JSON.parse(contents || '{}'),
				...consts,
			})
	);
	await updateFile(
		playground,
		`${documentRoot}/wp-config.php`,
		(contents) => {
			if (!contents.includes('playground-consts.json')) {
				return `<?php
	$consts = json_decode(file_get_contents('./playground-consts.json'), true);
	foreach ($consts as $const => $value) {
		if (!defined($const)) {
			define($const, $value);
		}
	}
?>${contents}`;
			}
			return contents;
		}
	);
};
