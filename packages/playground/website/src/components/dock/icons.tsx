/**
 * Cylinder mark for the Database tool. @wordpress/icons has no database glyph,
 * so we draw one here, matching the local-SVG pattern used elsewhere in the app.
 */
export function DockDatabaseIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<ellipse
				cx="12"
				cy="6"
				rx="6.25"
				ry="2.75"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			/>
			<path
				d="M5.75 6v12c0 1.52 2.8 2.75 6.25 2.75s6.25-1.23 6.25-2.75V6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			/>
			<path
				d="M5.75 12c0 1.52 2.8 2.75 6.25 2.75s6.25-1.23 6.25-2.75"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			/>
		</svg>
	);
}

/**
 * Curly-braces mark for the Blueprint tool. Blueprints are JSON, so `{}` reads
 * truer than the angle-bracket `<>` glyph, which connotes HTML/markup. The arms
 * curve continuously into the tongue so it reads as calligraphic braces.
 */
export function DockBlueprintIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{/* Keep fill none so future dock CSS cannot fill the open paths. */}
			<path
				fill="none"
				d="M9 4C7 4 7 6 6.8 8.5C6.65 10.4 6 11.4 4.5 12C6 12.6 6.65 13.6 6.8 15.5C7 18 7 20 9 20"
			/>
			<path
				fill="none"
				d="M15 4C17 4 17 6 17.2 8.5C17.35 10.4 18 11.4 19.5 12C18 12.6 17.35 13.6 17.2 15.5C17 18 17 20 15 20"
			/>
		</svg>
	);
}

/**
 * Chevron for the toggle pill's left half. CSS can rotate it when collapsed.
 */
export function DockCollapseChevronIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	);
}

/**
 * Screen mark for the full-width action: a monitor whose content fills it.
 */
export function DockFullWidthIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="3"
				y="6"
				width="18"
				height="12"
				rx="2.5"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			<rect
				x="5.4"
				y="8.4"
				width="13.2"
				height="7.2"
				rx="1.3"
				fill="currentColor"
			/>
		</svg>
	);
}

/**
 * Screen mark for the floating action: a small window inside the monitor.
 */
export function DockFloatingIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="3"
				y="6"
				width="18"
				height="12"
				rx="2.5"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			<rect
				x="7"
				y="9.5"
				width="10"
				height="5"
				rx="1.3"
				fill="currentColor"
			/>
		</svg>
	);
}
