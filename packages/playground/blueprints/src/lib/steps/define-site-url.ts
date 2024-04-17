import { StepHandler } from '.';
import { defineWpConfigConsts } from './define-wp-config-consts';

/**
 * Changes the site URL of the WordPress installation.
 *
 * @inheritDoc defineSiteUrl
 */
export interface DefineSiteUrlStep {
	step: 'defineSiteUrl';
	/** The URL */
	siteUrl: string;
}

/**
 * Sets WP_HOME and WP_SITEURL constants for the WordPress installation.
 *
 * Beware: Using this step makes no sense on playground.wordpress.net.
 * It is useful when you're building a custom Playground-based tool like wp-now,
 * or deploying Playground on a custom domain.
 *
 * @param playground The playground client.
 * @param siteUrl
 */
export const defineSiteUrl: StepHandler<DefineSiteUrlStep> = async (
	playground,
	{ siteUrl }
) => {
	await defineWpConfigConsts(playground, {
		consts: {
			WP_HOME: siteUrl,
			WP_SITEURL: siteUrl,
		},
	});
};
