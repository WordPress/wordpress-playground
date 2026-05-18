import type {
	BlueprintBundle,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import {
	getBlueprintDeclaration,
	resolveRemoteBlueprint,
} from '@wp-playground/blueprints';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import { StreamedFile } from '@php-wasm/stream-compression';
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

const TRUSTED_BLUEPRINT_INSTALL_PATHS = ['/my-apps/'];

export async function prepareBlueprintForRemoteInstall(
	blueprintUrl: string,
	corsProxyUrl?: string
): Promise<RemoteBlueprintInstall> {
	const blueprint = await resolveBlueprintForInstall(
		blueprintUrl,
		corsProxyUrl
	);
	const declaration = stripLoginFromInstallBlueprint(
		await getBlueprintDeclaration(blueprint)
	);
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

export async function resolveBlueprintForInstallExecution(
	blueprintUrl: string,
	corsProxyUrl?: string
): Promise<{
	blueprint: BlueprintBundle;
	declaration: BlueprintV1Declaration;
}> {
	const blueprint = await resolveBlueprintForInstall(
		blueprintUrl,
		corsProxyUrl
	);
	const declaration = stripLoginFromInstallBlueprint(
		await getBlueprintDeclaration(blueprint)
	);
	return {
		blueprint: withBlueprintDeclaration(blueprint, declaration),
		declaration,
	};
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

export function stripLoginFromInstallBlueprint(
	blueprint: BlueprintV1Declaration
): BlueprintV1Declaration {
	const blueprintWithoutLogin = { ...blueprint };
	delete blueprintWithoutLogin.login;

	if (blueprint.steps) {
		blueprintWithoutLogin.steps = blueprint.steps.filter(
			(step) => !isLoginStep(step)
		);
	}

	return blueprintWithoutLogin;
}

export function shouldSkipBlueprintInstallConfirmation(
	location: string | undefined
): boolean {
	const pathname = getWordPressPathname(location);
	return pathname
		? TRUSTED_BLUEPRINT_INSTALL_PATHS.includes(pathname)
		: false;
}

function getBlueprintLandingPage(
	blueprint: BlueprintV1Declaration
): string | undefined {
	return typeof blueprint.landingPage === 'string' && blueprint.landingPage
		? blueprint.landingPage
		: undefined;
}

function withBlueprintDeclaration(
	blueprint: BlueprintBundle,
	declaration: BlueprintV1Declaration
): BlueprintBundle {
	return {
		read: async (path: string) => {
			if (normalizeBlueprintPath(path) === 'blueprint.json') {
				return createBlueprintFile(declaration);
			}
			return blueprint.read(path);
		},
	};
}

function createBlueprintFile(
	declaration: BlueprintV1Declaration
): StreamedFile {
	const blueprintJson = JSON.stringify(declaration);
	const bytes = new TextEncoder().encode(blueprintJson);
	return StreamedFile.fromArrayBuffer(bytes, 'blueprint.json', {
		type: 'application/json',
		filesize: bytes.byteLength,
	});
}

function normalizeBlueprintPath(path: string): string {
	return path.replace(/^\/+/, '');
}

function isLoginStep(step: unknown): boolean {
	return (
		!!step &&
		typeof step === 'object' &&
		'step' in step &&
		(step as { step?: unknown }).step === 'login'
	);
}

function getWordPressPathname(
	location: string | undefined
): string | undefined {
	if (!location) {
		return;
	}

	let url: URL;
	try {
		url = new URL(location, 'https://playground.local');
	} catch {
		return;
	}

	const pathname = stripScopePrefix(url.pathname);
	return pathname === '/' || pathname.endsWith('/')
		? pathname
		: `${pathname}/`;
}

function stripScopePrefix(pathname: string): string {
	return pathname.replace(/^\/scope:[^/]+(?=\/|$)/, '') || '/';
}
