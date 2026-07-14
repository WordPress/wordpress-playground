import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import { buildVersion } from '../config';
import type { SiteMetadata } from '../state/redux/slice-sites';
import {
	personalWpUsageStatsEndpoint,
	personalWpUsageStatsHost,
} from 'virtual:personal-wp-usage-stats';

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export type PersonalWpUsageStatsEvent =
	| 'wordpress_installed'
	| 'returning_visit'
	| 'blueprint_installed'
	| 'remote_access_started'
	| 'health_check_installed'
	| 'sidebar_opened'
	| 'backup_restored';

export type PersonalWpUsageStatsProperties = Record<string, JsonValue>;
export type BlueprintInstallUsageStatsTrigger =
	| 'app-request'
	| 'dependent-tab-request'
	| 'url';
export type BlueprintInstallUsageStatsRequestSource = 'my-apps';

export type PersonalWpUsageStatsPayload = {
	schema: 'personal-wp-event/v1';
	app: 'personal-wp';
	build: string;
	event: PersonalWpUsageStatsEvent;
	properties: PersonalWpUsageStatsProperties;
};

export type PersonalWpUsageStatsOptions = {
	endpoint?: string;
	fetchImpl?: typeof fetch;
};

type BlueprintSourceClass =
	| 'same-origin'
	| 'wordpress-org'
	| 'github'
	| 'data-url'
	| 'external-url'
	| 'other-url'
	| 'invalid-url';

type BlueprintUsageStatsProperties = {
	blueprint_source?: BlueprintSourceClass;
	plugin_slugs?: string[];
};

type BlueprintUsageStatsOptions = {
	requestSource?: BlueprintInstallUsageStatsRequestSource;
};

const EVENT_SCHEMA = 'personal-wp-event/v1';
const SAFE_PLUGIN_SLUG = /^[a-z0-9][a-z0-9-]{0,100}$/;
const MAX_PLUGIN_SLUGS = 10;
const UNKNOWN_PLUGIN_SLUG = 'unknown';
const USAGE_STATS_HOST = personalWpUsageStatsHost || 'my.wordpress.net';

export function logPersonalWpEvent(
	event: PersonalWpUsageStatsEvent,
	properties: PersonalWpUsageStatsProperties = {},
	options: PersonalWpUsageStatsOptions = {}
): void {
	const endpoint = options.endpoint ?? personalWpUsageStatsEndpoint;
	if (!endpoint || !isUsageStatsAllowedOnCurrentHost()) {
		return;
	}

	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (!fetchImpl) {
		return;
	}

	const payload = createPersonalWpUsageStatsPayload(event, properties);
	void fetchImpl(endpoint, {
		method: 'POST',
		body: JSON.stringify(payload),
		headers: {
			'content-type': 'text/plain;charset=UTF-8',
		},
		credentials: 'omit',
		keepalive: true,
		mode: 'no-cors',
	}).catch(() => {
		// Logging is best-effort and must never affect the local WordPress app.
	});
}

export function isUsageStatsAllowedOnCurrentHost(): boolean {
	return globalThis.location?.hostname === USAGE_STATS_HOST;
}

export function createPersonalWpUsageStatsPayload(
	event: PersonalWpUsageStatsEvent,
	properties: PersonalWpUsageStatsProperties
): PersonalWpUsageStatsPayload {
	return {
		schema: EVENT_SCHEMA,
		app: 'personal-wp',
		build: buildVersion,
		event,
		properties,
	};
}

export function getSiteUsageStatsProperties(
	metadata: SiteMetadata,
	now = Date.now()
): PersonalWpUsageStatsProperties {
	return {
		site_age_bucket: getAgeBucket(metadata.whenCreated, now),
		previous_visit_age_bucket: getAgeBucket(metadata.lastAccessDate, now),
	};
}

export function shouldLogReturningVisitUsageStats(
	metadata: SiteMetadata,
	now = Date.now()
): boolean {
	return metadata.lastUsageStatsReturningVisitDate !== getUsageStatsDate(now);
}

export function getUsageStatsDate(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(0, 10);
}

export function getBlueprintUsageStatsProperties(
	blueprint: BlueprintV1Declaration,
	blueprintUrl?: string,
	options: BlueprintUsageStatsOptions = {}
): BlueprintUsageStatsProperties {
	const steps = ((blueprint.steps || []) as unknown[]).filter(
		isBlueprintStep
	);
	const shouldReportAppDetails = options.requestSource === 'my-apps';
	const pluginSlugs = shouldReportAppDetails
		? getBlueprintPluginSlugs(blueprint, steps)
		: [];

	const properties: BlueprintUsageStatsProperties = {};

	if (pluginSlugs.length > 0) {
		properties.plugin_slugs = pluginSlugs;
	}

	if (blueprintUrl) {
		properties.blueprint_source = classifyBlueprintUrl(blueprintUrl);
	}

	return properties;
}

export function classifyBlueprintUrl(url: string): BlueprintSourceClass {
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url, globalThis.location?.href);
	} catch {
		return 'invalid-url';
	}

	if (parsedUrl.protocol === 'data:') {
		return 'data-url';
	}
	if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
		return 'other-url';
	}
	if (parsedUrl.origin === globalThis.location?.origin) {
		return 'same-origin';
	}

	const host = parsedUrl.hostname.toLowerCase();
	if (host === 'wordpress.org' || host.endsWith('.wordpress.org')) {
		return 'wordpress-org';
	}
	if (
		host === 'github.com' ||
		host.endsWith('.github.com') ||
		host === 'raw.githubusercontent.com'
	) {
		return 'github';
	}
	return 'external-url';
}

function getAgeBucket(timestamp: number | undefined, now: number): string {
	if (!timestamp) {
		return 'unknown';
	}
	const ageDays = Math.max(
		0,
		Math.floor((now - timestamp) / (24 * 60 * 60 * 1000))
	);
	if (ageDays === 0) {
		return 'same-day';
	}
	if (ageDays <= 7) {
		return '1-7-days';
	}
	if (ageDays <= 30) {
		return '8-30-days';
	}
	if (ageDays <= 90) {
		return '31-90-days';
	}
	return 'over-90-days';
}

function isBlueprintStep(
	step: unknown
): step is { step: string; [key: string]: unknown } {
	return (
		!!step &&
		typeof step === 'object' &&
		'step' in step &&
		typeof (step as { step?: unknown }).step === 'string'
	);
}

function getBlueprintPluginSlugs(
	blueprint: BlueprintV1Declaration,
	steps: Array<{ step: string; [key: string]: unknown }>
): string[] {
	const slugs: string[] = [];
	const plugins = (blueprint as { plugins?: unknown }).plugins;
	if (Array.isArray(plugins)) {
		for (const plugin of plugins) {
			if (typeof plugin === 'string' && !addPluginSlug(slugs, plugin)) {
				addUnknownPluginSlug(slugs);
			}
		}
	}

	for (const step of steps) {
		if (step.step !== 'installPlugin') {
			continue;
		}
		const pluginSlug = getInstallPluginStepSlug(step);
		if (!pluginSlug || !addPluginSlug(slugs, pluginSlug)) {
			addUnknownPluginSlug(slugs);
		}
	}

	return slugs;
}

function getInstallPluginStepSlug(step: {
	step: string;
	[key: string]: unknown;
}): string | undefined {
	const options = getRecordProperty(step, 'options');
	const targetFolderName =
		options && getStringProperty(options, 'targetFolderName');
	if (targetFolderName) {
		const slug = normalizePluginSlug(targetFolderName);
		if (slug) {
			return slug;
		}
	}

	for (const resource of getPluginResourceObjects(step)) {
		const resourceType = getStringProperty(resource, 'resource');
		if (resourceType === 'wordpress.org/plugins') {
			const slug = getStringProperty(resource, 'slug');
			if (slug) {
				const normalizedSlug = normalizePluginSlug(slug);
				if (normalizedSlug) {
					return normalizedSlug;
				}
			}
		}

		const url = getStringProperty(resource, 'url');
		if (url) {
			const githubSlug = getPluginSlugFromGithubUrl(url);
			if (githubSlug) {
				return githubSlug;
			}
		}
	}

	return undefined;
}

function getPluginResourceObjects(step: {
	step: string;
	[key: string]: unknown;
}): Array<Record<string, unknown>> {
	const resources: Array<Record<string, unknown>> = [];
	for (const property of ['pluginData', 'pluginZipFile']) {
		const value = getRecordProperty(step, property);
		if (value) {
			resources.push(value);
		}
	}
	return resources;
}

function getPluginSlugFromGithubUrl(url: string): string | undefined {
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return;
	}

	const host = parsedUrl.hostname.toLowerCase();
	if (
		host !== 'github.com' &&
		host !== 'www.github.com' &&
		host !== 'raw.githubusercontent.com'
	) {
		return;
	}

	const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
	if (pathParts.length < 2) {
		return;
	}

	return normalizePluginSlug(pathParts[1]);
}

function addPluginSlug(slugs: string[], value: string): boolean {
	if (slugs.length >= MAX_PLUGIN_SLUGS) {
		return false;
	}

	const slug = normalizePluginSlug(value);
	if (slug && !slugs.includes(slug)) {
		slugs.push(slug);
		return true;
	}
	return !!slug;
}

function addUnknownPluginSlug(slugs: string[]): void {
	addPluginSlug(slugs, UNKNOWN_PLUGIN_SLUG);
}

function normalizePluginSlug(value: string): string | undefined {
	const slug = value
		.trim()
		.replace(/\.git$/i, '')
		.toLowerCase();
	return SAFE_PLUGIN_SLUG.test(slug) ? slug : undefined;
}

function getRecordProperty(
	value: Record<string, unknown>,
	property: string
): Record<string, unknown> | undefined {
	const propertyValue = value[property];
	if (
		propertyValue &&
		typeof propertyValue === 'object' &&
		!Array.isArray(propertyValue)
	) {
		return propertyValue as Record<string, unknown>;
	}
	return undefined;
}

function getStringProperty(
	value: Record<string, unknown>,
	property: string
): string | undefined {
	const propertyValue = value[property];
	return typeof propertyValue === 'string' ? propertyValue : undefined;
}
