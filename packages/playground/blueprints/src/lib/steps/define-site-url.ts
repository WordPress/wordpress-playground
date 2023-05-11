import { StepHandler } from '.';
import { defineWpConfigConsts } from './define-wp-config-consts';

export interface DefineSiteUrlStep {
	step: 'defineSiteUrl';
	siteUrl: string;
}

/**
 * Sets site URL of the WordPress installation.
 *
 * @param playground The playground client.
 * @param siteUrl
 */
export const defineSiteUrl: StepHandler<DefineSiteUrlStep> = async (
	playground,
	{ siteUrl }
) => {
	return await defineWpConfigConsts(playground, {
		consts: {
			WP_HOME: siteUrl,
			WP_SITEURL: siteUrl,
		},
	});
};
