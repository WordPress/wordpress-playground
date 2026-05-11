import type {
	BlueprintBundle,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import {
	getBlueprintDeclaration,
	resolveRemoteBlueprint,
} from '@wp-playground/blueprints';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';

export type RemoteBlueprintInstall = {
	blueprintUrl: string;
	landingPage?: string;
};

export async function prepareBlueprintForRemoteInstall(
	blueprintUrl: string,
	corsProxyUrl?: string
): Promise<RemoteBlueprintInstall> {
	const blueprint = await resolveBlueprintForInstall(
		blueprintUrl,
		corsProxyUrl
	);
	const declaration = await getBlueprintDeclaration(blueprint);
	const landingPage = getBlueprintLandingPage(declaration);
	return landingPage ? { blueprintUrl, landingPage } : { blueprintUrl };
}

export async function resolveBlueprintForInstall(
	blueprintUrl: string,
	corsProxyUrl?: string
): Promise<BlueprintBundle> {
	const playgroundUrl =
		typeof window === 'undefined' ? undefined : window.location.href;
	return await resolveRemoteBlueprint(blueprintUrl, {
		corsProxy: corsProxyUrl,
		fetch: (input, init) =>
			fetchWithCorsProxy(
				input instanceof URL ? input.toString() : input,
				init,
				corsProxyUrl,
				playgroundUrl
			),
	});
}

export async function fetchBlueprint(
	blueprintUrl: string,
	corsProxyUrl?: string
): Promise<BlueprintV1Declaration> {
	const blueprint = await resolveBlueprintForInstall(
		blueprintUrl,
		corsProxyUrl
	);
	return await getBlueprintDeclaration(blueprint);
}

function getBlueprintLandingPage(
	blueprint: BlueprintV1Declaration
): string | undefined {
	return typeof blueprint.landingPage === 'string' && blueprint.landingPage
		? blueprint.landingPage
		: undefined;
}
