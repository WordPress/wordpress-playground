import { Circle, Path, SVG } from '@wordpress/components';

/**
 * A generic version-control "branch" glyph — intentionally not tied to any
 * single git hosting provider (GitHub, GitLab, Bitbucket, ...), since a
 * `git:directory` Blueprint resource can point at any of them.
 */
export const GitIcon = (
	<SVG xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<Circle cx="6" cy="6" r="2.25" style={{ fill: 'currentcolor' }} />
		<Circle cx="6" cy="18" r="2.25" style={{ fill: 'currentcolor' }} />
		<Circle cx="18" cy="12" r="2.25" style={{ fill: 'currentcolor' }} />
		<Path
			d="M6 8.25V15.75"
			style={{
				stroke: 'currentcolor',
				strokeWidth: 1.6,
				fill: 'none',
			}}
		/>
		<Path
			d="M8.1 7 C12 7, 14 12, 15.9 12"
			style={{
				stroke: 'currentcolor',
				strokeWidth: 1.6,
				fill: 'none',
			}}
		/>
	</SVG>
);
