import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';

/**
 *
 * @param pattern A path string with named groups, e.g. `/manager/:siteSlug`
 * @returns Same as useNavigator, but `params` contains matched params from the pattern.
 */
export function useNavigatorParams(pattern: string) {
	const navigator = useNavigator();
	const { location, params, goTo, goBack, goToParent } = navigator;

	const paramNames: string[] = [];
	const regexPattern = pattern.replace(/\/:(\w+)/g, (_, paramName) => {
		paramNames.push(paramName);
		return '/([^/]+)';
	});

	const regex = new RegExp(`^${regexPattern}$`);
	const match = location?.path?.match(regex);
	const matchedParams: Record<string, string> = {};

	if (match) {
		paramNames.forEach((name: string, index) => {
			matchedParams[name] = decodeURIComponent(match[index + 1]);
		});
	}

	return {
		location,
		goTo,
		goBack,
		goToParent,
		params,
		matchedParams,
	};
}
