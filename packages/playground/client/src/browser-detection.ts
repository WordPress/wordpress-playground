export function isChromiumBasedBrowser(navigatorObject: Navigator = navigator) {
	const brands = (
		navigatorObject as Navigator & {
			userAgentData?: { brands?: Array<{ brand: string }> };
		}
	).userAgentData?.brands;

	if (brands) {
		return brands.some(({ brand }) =>
			['Chromium', 'Google Chrome', 'Microsoft Edge', 'Opera'].includes(
				brand
			)
		);
	}

	return /\b(?:Chrome|Chromium|Edg|OPR)\//.test(navigatorObject.userAgent);
}
