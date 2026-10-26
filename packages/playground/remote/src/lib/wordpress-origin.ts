/**
 * Select the configured sandbox for ?reprint; never take a hostname from its value.
 *
 * For example, app/remote.html?reprint selects the sandbox. A WordPress page
 * already on that sandbox keeps it without putting ?reprint on every navigation.
 * Other app documents use the app origin.
 * The presence of the flag enables the sandbox, even for ?reprint=0.
 */
export function selectWordPressOrigin(
	context: URL,
	appOrigin: string,
	sandboxOrigin: string
): string {
	return context.origin === sandboxOrigin ||
		context.searchParams.has('reprint')
		? sandboxOrigin
		: appOrigin;
}
