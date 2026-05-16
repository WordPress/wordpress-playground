import type {
	BlueprintBundle,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import {
	getBlueprintDeclaration,
	resolveRemoteBlueprint,
} from '@wp-playground/blueprints';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import { analyzeBlueprint } from '../../lib/blueprint-confirmation';
import type { BlueprintWarning } from '../../lib/blueprint-confirmation';

export type RemoteBlueprintInstall = {
	blueprintUrl: string;
	landingPage?: string;
};

export type BlueprintInstallPreview = {
	title: string;
	description?: string;
	author?: string;
	warnings: BlueprintWarning[];
	json: string;
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

export async function getBlueprintInstallPreview(
	blueprintUrl: string,
	corsProxyUrl?: string
): Promise<BlueprintInstallPreview> {
	const blueprint = await fetchBlueprint(blueprintUrl, corsProxyUrl);
	return {
		title: blueprint.meta?.title ?? 'Untitled app',
		description: blueprint.meta?.description ?? blueprint.description,
		author: blueprint.meta?.author,
		warnings: analyzeBlueprint(blueprint).warnings,
		json: JSON.stringify(blueprint, null, 2),
	};
}

export function getBlueprintInstallSource(blueprintUrl: string): {
	label: string;
} {
	const url = new URL(blueprintUrl);
	if (url.protocol === 'data:') {
		return { label: 'this page' };
	}
	if (url.host) {
		return { label: url.host };
	}
	if (url.origin && url.origin !== 'null') {
		return { label: url.origin };
	}
	return {
		label: `${url.protocol.replace(/:$/, '') || 'unknown'} source`,
	};
}

function getBlueprintLandingPage(
	blueprint: BlueprintV1Declaration
): string | undefined {
	return typeof blueprint.landingPage === 'string' && blueprint.landingPage
		? blueprint.landingPage
		: undefined;
}
