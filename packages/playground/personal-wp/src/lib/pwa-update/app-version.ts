import { buildVersion } from '../config';

export const APP_VERSION_ENDPOINT = '/app-version.json';
export const APP_VERSION_SCHEMA = 'personal-wp-app-version/v1';
export const APP_VERSION_CHECK_TIMEOUT_MS = 2500;

export type AppVersionCheckResult =
	| {
			status: 'current';
			currentVersion: string;
			deployedVersion: string;
	  }
	| {
			status: 'update-available';
			currentVersion: string;
			deployedVersion: string;
	  }
	| {
			status: 'unknown';
			currentVersion: string;
			reason: 'fetch-failed' | 'invalid-payload' | 'not-ok';
	  };

type AppVersionPayload = {
	schema: typeof APP_VERSION_SCHEMA;
	buildVersion: string;
};

type FetchAppVersionOptions = {
	currentVersion?: string;
	endpoint?: string;
	fetchImpl?: typeof fetch;
	now?: () => number;
	timeoutMs?: number;
};

export async function checkAppVersion({
	currentVersion = buildVersion,
	endpoint = APP_VERSION_ENDPOINT,
	fetchImpl = globalThis.fetch?.bind(globalThis),
	now = Date.now,
	timeoutMs = APP_VERSION_CHECK_TIMEOUT_MS,
}: FetchAppVersionOptions = {}): Promise<AppVersionCheckResult> {
	if (!fetchImpl) {
		return {
			status: 'unknown',
			currentVersion,
			reason: 'fetch-failed',
		};
	}

	const controller =
		typeof AbortController === 'undefined'
			? undefined
			: new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;

	if (controller && timeoutMs > 0) {
		timeout = setTimeout(() => controller.abort(), timeoutMs);
	}

	try {
		const response = await fetchImpl(getCacheBustedUrl(endpoint, now), {
			cache: 'no-store',
			headers: {
				Accept: 'application/json',
			},
			signal: controller?.signal,
		});

		if (!response.ok) {
			return {
				status: 'unknown',
				currentVersion,
				reason: 'not-ok',
			};
		}

		const payload: unknown = await response.json();
		if (!isAppVersionPayload(payload)) {
			return {
				status: 'unknown',
				currentVersion,
				reason: 'invalid-payload',
			};
		}

		if (payload.buildVersion !== currentVersion) {
			return {
				status: 'update-available',
				currentVersion,
				deployedVersion: payload.buildVersion,
			};
		}

		return {
			status: 'current',
			currentVersion,
			deployedVersion: payload.buildVersion,
		};
	} catch {
		return {
			status: 'unknown',
			currentVersion,
			reason: 'fetch-failed',
		};
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
}

function getCacheBustedUrl(endpoint: string, now: () => number): string {
	const baseUrl =
		typeof window === 'undefined'
			? 'http://localhost/'
			: window.location.href;
	const url = new URL(endpoint, baseUrl);
	url.searchParams.set('_', String(now()));
	return url.toString();
}

function isAppVersionPayload(value: unknown): value is AppVersionPayload {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const payload = value as Partial<AppVersionPayload>;
	return (
		payload.schema === APP_VERSION_SCHEMA &&
		typeof payload.buildVersion === 'string' &&
		payload.buildVersion.length > 0
	);
}
