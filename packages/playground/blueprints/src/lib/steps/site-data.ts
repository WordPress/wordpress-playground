import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';

/**
 * @inheritDoc setSiteOptions
 * @hasRunnableExample
 *
 * @example
 *
 * <code>
 * {
 *     "step": "setSiteOptions",
 *     "options": {
 *         "blogname": "My Blog",
 *         "blogdescription": "A great blog"
 *     }
 * }
 * </code>
 */
export type SetSiteOptionsStep = {
	/** The name of the step. Must be "setSiteOptions". */
	step: 'setSiteOptions';
	/** The options to set on the site. */
	options: Record<string, unknown>;
};

/**
 * Sets site options. This is equivalent to calling `update_option` for each
 * option in the `options` object.
 */
export const setSiteOptions: StepHandler<SetSiteOptionsStep> = async (
	client,
	{ options }
) => {
	await client.run({
		throwOnError: true,
		code: `<?php
		include 'wordpress/wp-load.php';
		$site_options = ${phpVar(options)};
		foreach($site_options as $name => $value) {
			update_option($name, $value);
		}
		echo "Success";
		`,
	});
};

/**
 * @inheritDoc updateUserMeta
 * @hasRunnableExample
 *
 * @example
 *
 * <code>
 * {
 *     "step": "updateUserMeta",
 *     "meta": {
 * 	       "first_name": "John",
 * 	       "last_name": "Doe"
 *     },
 *     "userId": 1
 * }
 * </code>
 */
export interface UpdateUserMetaStep {
	step: 'updateUserMeta';
	/** An object of user meta values to set, e.g. { "first_name": "John" } */
	meta: Record<string, unknown>;
	/** User ID */
	userId: number;
}

/**
 * Updates user meta. This is equivalent to calling `update_user_meta` for each
 * meta value in the `meta` object.
 */
export const updateUserMeta: StepHandler<UpdateUserMetaStep> = async (
	client,
	{ meta, userId }
) => {
	await client.run({
		throwOnError: true,
		code: `<?php
		include 'wordpress/wp-load.php';
		$meta = ${phpVar(meta)};
		foreach($meta as $name => $value) {
			update_user_meta(${phpVar(userId)}, $name, $value);
		}
		`,
	});
};
