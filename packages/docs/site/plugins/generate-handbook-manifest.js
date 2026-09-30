const fs = require('node:fs');
// Native filesystem paths and POSIX URL paths, not Playground filesystem paths.
const path = require('node:path');
const { aliasedSitePathToRelativePath } = require('@docusaurus/utils');

const MARKDOWN_BASE_URL =
	'https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/';

// Preserve published handbook URLs that differ from the Docusaurus routes.
// New pages use their Docusaurus slug automatically.
const HANDBOOK_PATHS = {
	'main/introduction': 'handbook',
	'main/contributing/contributor-day-table-lead':
		'contributing/contributor-day-table-lead',
	'blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them':
		'blueprints/tutorial/what-are-blueprints',
	'blueprints/tutorial/how-to-load-run-blueprints':
		'blueprints/tutorial/how-to-load-run',
	'blueprints/tutorial/build-your-first-blueprint':
		'blueprints/tutorial/build-your-first',
	'developers/build-an-app/index': 'developers/build-an-app',
	'developers/xdebug/introduction': 'developers/xdebug',
	'developers/apis/javascript-api/index-html-vs-remote-html':
		'developers/apis/javascript-api/index-html-vs-remote-html',
	'developers/apis/javascript-api/blueprint-json-in-api-client':
		'developers/apis/javascript-api/blueprint-json',
	'developers/apis/javascript-api/blueprint-functions-in-api-client':
		'developers/apis/javascript-api/blueprint-functions',
};

// These pages embed TypeDoc components. Import their materialized Markdown instead.
const HANDBOOK_SOURCES = {
	'blueprints/steps': 'static/handbook/blueprints-steps.md',
	'developers/apis/javascript-api/playground-api-client':
		'static/handbook/playground-api-client.md',
};

module.exports = function generateHandbookManifest({ i18n }) {
	let entries;
	return {
		name: 'generate-handbook-manifest',
		allContentLoaded({ allContent }) {
			if (i18n.currentLocale === i18n.defaultLocale) {
				entries = getHandbookEntries(allContent);
			}
		},
		async postBuild({ outDir }) {
			if (i18n.currentLocale !== i18n.defaultLocale) {
				return;
			}

			const manifest = Object.fromEntries(
				entries.map(({ key, entry }) => [
					key,
					{
						...entry,
						// The manifest is served from Pages, but Markdown lives in GitHub.
						markdown_source: new URL(
							entry.markdown_source,
							MARKDOWN_BASE_URL
						).href,
					},
				])
			);
			fs.writeFileSync(
				path.join(outDir, 'manifest.json'),
				`${JSON.stringify(manifest, null, 2)}\n`
			);
		},
	};
};

function getHandbookEntries(allContent) {
	const version = allContent[
		'docusaurus-plugin-content-docs'
	]?.default?.loadedVersions.find(
		({ versionName }) => versionName === 'current'
	);
	if (!version) {
		throw new Error(
			'Cannot generate handbook manifest: current docs version is missing.'
		);
	}

	const docs = new Map(version.docs.map((doc) => [doc.id, doc]));
	const seen = new Set();
	const keys = new Set();
	const orders = new Map();
	const entries = [];
	for (const sidebar of Object.values(version.sidebars)) {
		visit(sidebar, null);
	}

	for (const doc of version.docs) {
		if (!isExcluded(doc) && !seen.has(doc.id)) {
			throw new Error(
				`Documentation page "${doc.id}" is missing from the handbook sidebar. ` +
					'Add it to sidebars.js or mark it orphan: true.'
			);
		}
	}
	return entries;

	function visit(items, parent) {
		for (const item of items) {
			if (item.type === 'doc') {
				addDoc(item.id, parent);
			} else if (item.type === 'category') {
				if (item.link && item.link.type !== 'doc') {
					throw new Error(
						`Handbook category "${item.label}" needs a Markdown document link.`
					);
				}
				const category = item.link
					? addDoc(item.link.id, parent)
					: parent;
				visit(item.items, category);
			}
		}
	}

	function addDoc(id, parent) {
		const doc = docs.get(id);
		if (!doc) {
			throw new Error(
				`Handbook sidebar references missing document "${id}".`
			);
		}
		if (isExcluded(doc)) {
			return parent;
		}
		const key = HANDBOOK_PATHS[id] ?? path.posix.relative('/', doc.slug);
		if (seen.has(id)) {
			return key;
		}
		if (!key || keys.has(key)) {
			throw new Error(
				`Duplicate or empty handbook path "${key}" for "${id}".`
			);
		}
		seen.add(id);
		keys.add(key);
		const order = (orders.get(parent) ?? 0) + 10;
		orders.set(parent, order);
		entries.push({
			key,
			doc,
			entry: {
				title: key === 'handbook' ? 'WordPress Playground' : doc.title,
				slug: path.posix.basename(key),
				markdown_source:
					HANDBOOK_SOURCES[id] ??
					aliasedSitePathToRelativePath(doc.source),
				parent,
				order,
			},
		});
		return key;
	}
}

function isExcluded(doc) {
	return doc.draft || doc.unlisted || doc.frontMatter.orphan === true;
}

module.exports.getHandbookEntries = getHandbookEntries;
