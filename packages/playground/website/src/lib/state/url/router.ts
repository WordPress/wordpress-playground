import type { SiteInfo } from '../redux/slice-sites';
import { updateUrl } from './router-hooks';
import { decodeBase64ToString } from '../../base64';

export function redirectTo(url: string) {
	window.history.pushState({}, '', url);
}

export interface QueryAPIParams {
	name?: string;
	wp?: string;
	php?: string;
	'php-extension'?: string[];
	language?: string;
	multisite?: 'yes' | 'no';
	networking?: 'yes' | 'no';
	theme?: string[];
	login?: 'yes' | 'no';
	plugin?: string[];
	blueprint?: string;
	'core-pr'?: string;
	'gutenberg-branch'?: string;
	'gutenberg-pr'?: string;
	'import-site'?: string;
	'import-wxr'?: string;
	'import-content'?: string;
	url?: string;
	'blueprint-url'?: string;
	'page-title'?: string;
}

/**
 * Parses a blueprint string into a blueprint object.
 *
 * Accepts either plain JSON or base64-encoded JSON — older shareable
 * links wrap the blueprint in base64 to avoid URL-encoding noise, and
 * we still need to read those.
 *
 * On failure, throws an `Error` whose message includes the underlying
 * JSON parse error and, when `%XX` escapes are still present in the
 * input, a hint that the URL fragment may have been double-encoded.
 */
export function parseBlueprint(rawData: string) {
	const errors: unknown[] = [];
	try {
		return JSON.parse(rawData);
	} catch (e) {
		errors.push(e);
	}
	try {
		return JSON.parse(decodeBase64ToString(rawData));
	} catch (e) {
		errors.push(e);
	}
	throw new Error(formatInvalidBlueprintError(rawData, errors));
}

/**
 * Builds the user-facing message for an invalid blueprint string.
 *
 * Picks whichever underlying error is more likely to help: the
 * base64-decode-then-parse error if the input looks base64-shaped,
 * otherwise the plain JSON.parse error.
 */
function formatInvalidBlueprintError(
	rawData: string,
	errors: unknown[]
): string {
	const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(rawData.trim());
	const primary = looksLikeBase64 && errors[1] ? errors[1] : errors[0];
	const detail =
		primary instanceof Error ? primary.message : String(primary ?? '');
	const sentences = ['Invalid blueprint'];
	if (detail) {
		sentences.push(detail);
	}
	if (/%[0-9A-Fa-f]{2}/.test(rawData)) {
		sentences.push(
			'The input still contains %XX escapes after decoding, so the URL fragment may have been double-encoded'
		);
	}
	return sentences.join('. ') + '.';
}

/**
 * Builds navigation targets for Playground site changes.
 *
 * The helpers describe user-facing routing intents, such as switching to a
 * saved Playground or starting a fresh setup. They do not change browser
 * history themselves; callers navigate to the returned URL.
 */
export class PlaygroundRoute {
	/**
	 * Builds the navigation target for switching to an existing Playground.
	 *
	 * Temporary sites reuse their original setup URL. Stored sites use a
	 * `site-slug` route while preserving selected query parameters from the
	 * current URL.
	 */
	static site(site: SiteInfo, baseUrl: string = window.location.href) {
		if (site.metadata.storage === 'none') {
			return updateUrl(baseUrl, site.originalUrlParams || {});
		} else {
			const baseParams = new URLSearchParams(baseUrl.split('?')[1]);
			const preserveParamsKeys = [
				'mode',
				'networking',
				'login',
				'php',
				'wp',
				'language',
				'multisite',
				'url',
				'page-title',
				'mcp',
				'mcp-port',
				'can-save',
			];
			const preserveParams: Record<string, string | null> = {};
			for (const param of preserveParamsKeys) {
				if (baseParams.has(param)) {
					preserveParams[param] = baseParams.get(param);
				}
			}
			return updateUrl(baseUrl, {
				searchParams: { 'site-slug': site.slug, ...preserveParams },
				hash: '',
			});
		}
	}

	/**
	 * Get the URL that starts a fresh temporary Playground.
	 *
	 * It comes with `?storage=temp` and a random cache busting parameter
	 * and will not be autosaved regardless of the default browser-storage policy.
	 */
	static newTemporarySite(
		config: {
			query?: QueryAPIParams;
			hash?: string;
		} = {},
		baseUrl: string = window.location.href
	) {
		const query =
			(config.query as Record<string, string | undefined>) || {};
		return updateUrl(
			baseUrl,
			{
				searchParams: {
					...query,
					storage: 'temp',
					// Repeating the same temporary setup should still
					// navigate away from the current Playground.
					random: Math.random().toString(36).substring(2, 15),
				},
				hash: config.hash,
			},
			'replace'
		);
	}

	/**
	 * Get the URL that starts a fresh autosaved Playground.
	 *
	 * It comes with no `?storage` parameter, which allows the default browser-storage
	 * policy to take effect. It still includes a random cache busting parameter anyway.
	 */
	static newSite(
		config: {
			query?: QueryAPIParams;
			hash?: string;
		} = {},
		baseUrl: string = window.location.href
	) {
		const query =
			(config.query as Record<string, string | undefined>) || {};
		return updateUrl(
			baseUrl,
			{
				searchParams: {
					...query,
					// Repeating the same setup should still navigate away from
					// the current Playground.
					random: Math.random().toString(36).substring(2, 15),
				},
				hash: config.hash,
			},
			'replace'
		);
	}
}

/**
 * Checks if the current Playground shell should offer browser saving.
 */
export function isSiteSavingDisabled(
	url: URL = new URL(document.location.href),
	win: Window = window
): boolean {
	return (
		url.searchParams.get('can-save') === 'no' ||
		url.searchParams.get('mode') === 'seamless' ||
		isEmbeddedInAnIframe(win)
	);
}

function isEmbeddedInAnIframe(win: Window): boolean {
	try {
		return win.self !== win.top;
	} catch {
		return true;
	}
}

/**
 * Checks if the MCP server bridge is enabled via the `?mcp-port` query parameter.
 */
export function isMcpServerEnabled(): boolean {
	return new URL(document.location.href).searchParams.has('mcp-port');
}
