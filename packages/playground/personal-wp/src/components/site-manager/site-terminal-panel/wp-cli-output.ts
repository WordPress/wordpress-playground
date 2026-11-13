/**
 * Removes transport artifacts that are not part of WP-CLI's output.
 */
export function formatWpCliOutput(output: string) {
	return (
		output
			// eslint-disable-next-line no-control-regex
			.replace(/\u001b\[[0-9;]*m/g, '')
			.trim()
	);
}
