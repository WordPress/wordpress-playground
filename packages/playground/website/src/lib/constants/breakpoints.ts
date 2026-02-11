/**
 * Named breakpoint constants for responsive layout decisions.
 * Use these inline, e.g. `window.innerWidth < BREAKPOINTS.tablet`.
 */
export const BREAKPOINTS = {
	/** Phones: < 600px */
	mobile: 600,
	/** Tablets: >= 600px and < 875px */
	tablet: 875,
	/** Desktops: >= 1024px */
	desktop: 1024,
} as const;
