/**
 * SVG icon components.
 *
 * These replace the @wordpress/icons package for standalone use.
 */

interface IconProps {
	className?: string;
	size?: number;
}

export function IconPlus({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M11 12.5V17.5H12.5V12.5H17.5V11H12.5V6H11V11H6V12.5H11Z" />
		</svg>
	);
}

export function IconDownload({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M18 11.3l-1-1.1-4.5 4.55V4h-1.5v10.75L6.5 10.2l-1 1.1 6.5 6.45 6-6.45zM17.5 18.5v-1.5h-11v1.5h11z" />
		</svg>
	);
}

export function IconCancel({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21ZM15.5303 8.46967L12 12L8.46967 8.46967L7.46967 9.46967L11 13L7.46967 16.5303L8.46967 17.5303L12 14L15.5303 17.5303L16.5303 16.5303L13 13L16.5303 9.46967L15.5303 8.46967Z" />
		</svg>
	);
}

export function IconWordPress({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M12.158 12.786l-2.698 7.84c.806.236 1.657.365 2.54.365 1.047 0 2.051-.18 2.986-.508a1.023 1.023 0 01-.085-.156l-2.743-7.541zm-8.64-4.672c0 .18.01.357.027.533l3.625 9.94C4.68 16.66 3.097 14.53 3.097 12c0-1.454.35-2.827.97-4.038l-.008-.006-.542.158zm13.92-.012l2.07 5.69 1.278 4.326c.908-1.66 1.426-3.56 1.426-5.576 0-2.44-.697-4.72-1.903-6.651-.143.29-.41.65-1.03 1.073-.854.582-1.84 1.138-1.84 1.138zM12 2.958a9.015 9.015 0 00-6.06 2.307c-.063.032-.12.068-.173.11-.13.01-.258.02-.385.03.123.15.24.304.351.465l.037.065c.023.04.046.08.067.12-.086.225-.127.405-.15.582l-.023.117c.043.024.088.05.133.077l.058.038a.95.95 0 01.108.07l.047.034c.022.018.043.037.065.057l.03.028a.865.865 0 01.075.084l.028.036.015.02.024.039.007.014a1.82 1.82 0 01.075.162l.003.01-.128-.04a1.42 1.42 0 01-.112-.04l-.032-.014-.038-.018a1.316 1.316 0 01-.13-.074l-.02-.012-.037-.025a.95.95 0 01-.077-.055l-.027-.02a.796.796 0 01-.075-.063l-.019-.018a.618.618 0 01-.058-.057l-.022-.025-.033-.04a.75.75 0 01-.055-.08 3.138 3.138 0 01-.067-.114l-.014-.027a.666.666 0 00-.034-.057l-.006-.008c-.064-.1-.135-.193-.21-.284a9.036 9.036 0 013.816 18.303c.227.005.454.003.682-.007A9.042 9.042 0 0012 2.958z" />
		</svg>
	);
}

export function IconEdit({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M20.1 5.1L16.9 2 6.2 12.7l-1.3 4.4 4.5-1.3L20.1 5.1zM4 20.8h16v-1.5H4v1.5z" />
		</svg>
	);
}

export function IconLink({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M15.6 7.2H14v1.5h1.6c2 0 3.7 1.7 3.7 3.7s-1.7 3.7-3.7 3.7H14v1.5h1.6c2.8 0 5.2-2.3 5.2-5.2 0-2.9-2.3-5.2-5.2-5.2zM4.7 12.4c0-2 1.7-3.7 3.7-3.7H10V7.2H8.4c-2.9 0-5.2 2.3-5.2 5.2 0 2.9 2.3 5.2 5.2 5.2H10v-1.5H8.4c-2 0-3.7-1.7-3.7-3.7zm4.6.9h5.3v-1.5H9.3v1.5z" />
		</svg>
	);
}

export function IconPlay({ className, size = 24 }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			<path d="M6 4l14 8-14 8V4z" />
		</svg>
	);
}
