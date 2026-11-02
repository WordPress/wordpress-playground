export type InstallBlueprintCommandResult = {
	status: 'success' | 'error';
	error?: string;
};
let installBlueprint:
	| ((url: string) => Promise<InstallBlueprintCommandResult>)
	| null = null;

/** Keeps the user's install confirmation in the current document. */
export function setUserBlueprintInstallCallback(
	callback: typeof installBlueprint
) {
	installBlueprint = callback;
}

export async function requestBlueprintInstall(
	_siteSlug: string,
	url: string
): Promise<InstallBlueprintCommandResult> {
	return (
		installBlueprint?.(url) ?? {
			status: 'error',
			error: 'Playground is not ready.',
		}
	);
}
