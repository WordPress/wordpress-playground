type SafariInstallPlatform = 'ios' | 'macos';

type MatchMedia = (query: string) => Pick<MediaQueryList, 'matches'>;

type NavigatorWithStandalone = Navigator & {
	standalone?: boolean;
};

export function shouldShowSafariStorageNotice(
	ua: string = getNavigatorUserAgent(),
	standalone: boolean | undefined = getNavigatorStandalone(),
	matchMedia: MatchMedia | undefined = getWindowMatchMedia()
): boolean {
	return isSafari(ua) && !isRunningAsPWA(standalone, matchMedia);
}

export function getSafariInstallPlatform(
	ua: string = getNavigatorUserAgent(),
	platform: string = getNavigatorPlatform(),
	maxTouchPoints: number = getNavigatorMaxTouchPoints()
): SafariInstallPlatform | null {
	if (!isSafari(ua)) {
		return null;
	}

	return isIOS(ua, platform, maxTouchPoints) ? 'ios' : 'macos';
}

export function isSafari(ua: string = getNavigatorUserAgent()): boolean {
	return (
		/Version\//.test(ua) &&
		/Safari\//.test(ua) &&
		!/(Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|OPiOS)\//.test(ua)
	);
}

export function isIOS(
	ua: string = getNavigatorUserAgent(),
	platform: string = getNavigatorPlatform(),
	maxTouchPoints: number = getNavigatorMaxTouchPoints()
): boolean {
	return (
		/iPad|iPhone|iPod/.test(ua) ||
		(platform === 'MacIntel' && maxTouchPoints > 1 && /Mobile\//.test(ua))
	);
}

export function isRunningAsPWA(
	standalone: boolean | undefined = getNavigatorStandalone(),
	matchMedia: MatchMedia | undefined = getWindowMatchMedia()
): boolean {
	if (standalone === true) {
		return true;
	}

	return matchMedia?.('(display-mode: standalone)').matches ?? false;
}

function getNavigatorUserAgent(): string {
	return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function getNavigatorPlatform(): string {
	return typeof navigator === 'undefined' ? '' : navigator.platform;
}

function getNavigatorMaxTouchPoints(): number {
	return typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints;
}

function getNavigatorStandalone(): boolean | undefined {
	if (typeof navigator === 'undefined') {
		return undefined;
	}
	return (navigator as NavigatorWithStandalone).standalone;
}

function getWindowMatchMedia(): MatchMedia | undefined {
	if (typeof window === 'undefined' || !window.matchMedia) {
		return undefined;
	}

	return window.matchMedia.bind(window);
}
