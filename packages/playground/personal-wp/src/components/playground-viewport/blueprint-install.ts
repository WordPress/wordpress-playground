import type { BlueprintV1Declaration } from '@wp-playground/blueprints';

import { encodeStringAsBase64 } from '../../lib/base64';

export type RemoteBlueprintInstall = {
	blueprintUrl: string;
	landingPage?: string;
};

export async function prepareBlueprintForRemoteInstall(
	blueprintUrl: string
): Promise<RemoteBlueprintInstall> {
	const blueprint = await fetchBlueprint(blueprintUrl);
	const landingPage = getBlueprintLandingPage(blueprint);
	if (!landingPage) {
		return { blueprintUrl };
	}

	return {
		blueprintUrl: blueprintToDataUrl(
			getBlueprintWithoutLandingPage(blueprint)
		),
		landingPage,
	};
}

export async function fetchBlueprint(
	blueprintUrl: string
): Promise<BlueprintV1Declaration> {
	const response = await fetch(blueprintUrl);
	if (!response.ok) {
		throw new Error(
			`Could not download blueprint: ${response.status} ${response.statusText}`
		);
	}
	try {
		return (await response.json()) as BlueprintV1Declaration;
	} catch (e) {
		throw new Error('Blueprint response was not valid JSON.', {
			cause: e,
		});
	}
}

function getBlueprintLandingPage(
	blueprint: BlueprintV1Declaration
): string | undefined {
	return typeof blueprint.landingPage === 'string' && blueprint.landingPage
		? blueprint.landingPage
		: undefined;
}

function getBlueprintWithoutLandingPage(
	blueprint: BlueprintV1Declaration
): BlueprintV1Declaration {
	const { landingPage, ...blueprintWithoutLandingPage } = blueprint;
	return blueprintWithoutLandingPage;
}

function blueprintToDataUrl(blueprint: BlueprintV1Declaration): string {
	return `data:application/json;base64,${encodeStringAsBase64(
		JSON.stringify(blueprint)
	)}`;
}
