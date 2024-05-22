import { StepHandler } from '.';

/**
 * Deletes WordPress posts and comments and sets the auto increment sequence for the
 * posts and comments tables to 0.
 *
 * @private
 * @internal
 * @inheritDoc resetData
 * @example
 *
 * <code>
 * {
 * 		"step": "resetData"
 * }
 * </code>
 */
export interface ResetDataStep {
	step: 'resetData';
}

/**
 * @param playground Playground client.
 */
export const resetData: StepHandler<ResetDataStep> = async (
	playground,
	_options,
	progress?
) => {
	progress?.tracker?.setCaption('Resetting WordPress data');
	const docroot = await playground.documentRoot;
	await playground.run({
		env: {
			DOCROOT: docroot,
		},
		code: `<?php
		require getenv('DOCROOT') . '/wp-load.php';

		$GLOBALS['@pdo']->query('DELETE FROM wp_posts WHERE id > 0');
		$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_posts'");
		
		$GLOBALS['@pdo']->query('DELETE FROM wp_postmeta WHERE post_id > 1');
		$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=20 WHERE NAME='wp_postmeta'");

		$GLOBALS['@pdo']->query('DELETE FROM wp_comments');
		$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_comments'");

		$GLOBALS['@pdo']->query('DELETE FROM wp_commentmeta');
		$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_commentmeta'");
		`,
	});
};
