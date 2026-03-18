/**
 * Detects whether the current environment is iOS/iPadOS Safari
 * (not a WKWebView, not Chrome, not Firefox) and whether the app
 * is running as an installed PWA (standalone display mode).
 */

/**
 * Returns true when the device is running iOS or iPadOS.
 *
 * iPads with iPadOS 13+ report as "MacIntel" in the platform
 * string but expose multi-touch support, so we check both the
 * legacy UA tokens and the modern platform + touchPoints
 * combination.
 */
export function isIOS(
	ua: string = navigator.userAgent,
	platform: string = navigator.platform,
	maxTouchPoints: number = navigator.maxTouchPoints
): boolean {
	return (
		/iPad|iPhone|iPod/.test(ua) ||
		(platform === 'MacIntel' && maxTouchPoints > 1)
	);
}

/**
 * Returns true when the browser is Safari on iOS/iPadOS.
 *
 * Safari includes "Version/" in its user-agent string whereas
 * WKWebViews (in-app browsers) do not. Chrome on iOS identifies
 * itself with "CriOS" and Firefox with "FxiOS".
 */
export function isIOSSafari(
	ua: string = navigator.userAgent,
	platform: string = navigator.platform,
	maxTouchPoints: number = navigator.maxTouchPoints
): boolean {
	if (!isIOS(ua, platform, maxTouchPoints)) {
		return false;
	}
	// Safari proper includes "Version/"
	if (!/Version\//.test(ua)) {
		return false;
	}
	// Exclude Chrome and Firefox on iOS
	if (/CriOS\//.test(ua) || /FxiOS\//.test(ua)) {
		return false;
	}
	return true;
}

/**
 * Returns true when the app is running as an installed PWA
 * (standalone display mode).
 */
export function isRunningAsPWA(): boolean {
	return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Returns true when the user is on iOS Safari *and* the app is
 * not installed as a PWA — i.e. the user is at risk of losing
 * data due to Safari's ITP 7-day storage expiration policy.
 */
export function isIOSSafariWithoutPWA(
	ua?: string,
	platform?: string,
	maxTouchPoints?: number
): boolean {
	return isIOSSafari(ua, platform, maxTouchPoints) && !isRunningAsPWA();
}
