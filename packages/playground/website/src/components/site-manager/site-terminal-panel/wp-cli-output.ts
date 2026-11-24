/**
 * Removes transport artifacts that are not part of WP-CLI's output.
 */
export function formatWpCliOutput(output: string) {
	return (
		output
			.replace(/^#!\/usr\/bin\/env php\r?\n/, '')
			// eslint-disable-next-line no-control-regex
			.replace(/\u001b\[[0-9;]*m/g, '')
			.trim()
	);
}
