/**
 * Centralized breakpoint constants for responsive design
 */

export const BREAKPOINTS = {
	mobile: 600,
	tablet: 875,
	desktop: 1024,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * Check if window width is in mobile range
 * Default: < 600px
 */
export function isMobile(width?: number): boolean {
	const currentWidth =
		width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
	return currentWidth < BREAKPOINTS.mobile;
}

/**
 * Check if window width is in tablet range
 * Default: >= 600px and < 875px
 */
export function isTablet(width?: number): boolean {
	const currentWidth =
		width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
	return (
		currentWidth >= BREAKPOINTS.mobile && currentWidth < BREAKPOINTS.tablet
	);
}

/**
 * Check if window width is in desktop range
 * Default: >= 1024px
 */
export function isDesktop(width?: number): boolean {
	const currentWidth =
		width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
	return currentWidth >= BREAKPOINTS.desktop;
}

/**
 * Get current device type based on window width
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function getDeviceType(width?: number): DeviceType {
	const currentWidth =
		width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
	if (currentWidth < BREAKPOINTS.mobile) return 'mobile';
	if (currentWidth < BREAKPOINTS.tablet) return 'tablet';
	return 'desktop';
}
