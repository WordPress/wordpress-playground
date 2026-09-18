const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const generateManifest = require('./generate-handbook-manifest');
const redirectDocs = require('./redirect-docs-to-developer-wordpress-org');
const { getHandbookEntries } = generateManifest;

test('reflects added, removed, renamed and reordered docs without a saved manifest', () => {
	const intro = doc('main/introduction', '/');
	const guide = doc('main/guide', '/guide');
	const other = doc('main/other', '/other');
	const version = {
		versionName: 'current',
		docs: [intro, guide],
		sidebars: { main: [category(intro, [link(guide)])] },
	};
	assert.deepEqual(
		getHandbookEntries(content(version)).map(({ key }) => key),
		['handbook', 'guide']
	);
	version.docs.push(other);
	version.sidebars.main[0].items.unshift(link(other));
	guide.title = 'Updated guide';
	guide.slug = '/renamed-guide';
	guide.source = '@site/docs/main/renamed-guide.mdx';
	const entries = getHandbookEntries(content(version));
	assert.deepEqual(
		entries.map(({ key }) => key),
		['handbook', 'other', 'renamed-guide']
	);
	assert.equal(entries[2].entry.title, 'Updated guide');
	assert.equal(
		entries[2].entry.markdown_source,
		'docs/main/renamed-guide.mdx'
	);
	assert.equal(entries[2].entry.parent, 'handbook');
	assert.ok(entries[1].entry.order < entries[2].entry.order);
	version.docs = [intro, other];
	version.sidebars.main[0].items.pop();
	assert.deepEqual(
		getHandbookEntries(content(version)).map(({ key }) => key),
		['handbook', 'other']
	);
});

test('preserves handbook routes and materialized Markdown with nested sidebar parents', () => {
	const root = doc('developers/intro', '/developers/');
	const xdebug = doc(
		'developers/xdebug/introduction',
		'/developers/xdebug/introduction'
	);
	const child = doc(
		'developers/xdebug/getting-started',
		'/developers/xdebug/xdebug-getting-started'
	);
	const steps = doc('blueprints/steps', '/blueprints/steps');
	const client = doc(
		'developers/apis/javascript-api/playground-api-client',
		'/developers/apis/javascript-api/playground-api-client'
	);
	const entries = getHandbookEntries(
		content({
			versionName: 'current',
			docs: [root, xdebug, child, steps, client],
			sidebars: {
				main: [
					category(root, [
						category(xdebug, [link(xdebug), link(child)]),
						link(client),
					]),
					link(steps),
				],
			},
		})
	);
	assert.equal(entries.length, 5);
	assert.equal(entries[1].key, 'developers/xdebug');
	assert.equal(entries[2].entry.parent, 'developers/xdebug');
	assert.equal(
		entries[3].entry.markdown_source,
		'static/handbook/playground-api-client.md'
	);
	assert.equal(
		entries[4].entry.markdown_source,
		'static/handbook/blueprints-steps.md'
	);
});

test('excludes intentional orphans, drafts and unlisted docs but rejects accidental omissions', () => {
	const omitted = doc('main/missing', '/missing');
	const version = {
		versionName: 'current',
		docs: [omitted],
		sidebars: { main: [] },
	};
	assert.throws(
		() => getHandbookEntries(content(version)),
		/main\/missing.*missing from/
	);
	omitted.frontMatter.orphan = true;
	version.docs.push({ ...doc('draft', '/draft'), draft: true });
	version.docs.push({ ...doc('unlisted', '/unlisted'), unlisted: true });
	assert.deepEqual(getHandbookEntries(content(version)), []);
});

test('rejects path collisions and missing sidebar documents', () => {
	const first = doc('first', '/same');
	const second = doc('second', '/same');
	const version = {
		versionName: 'current',
		docs: [first, second],
		sidebars: { main: [link(first), link(second)] },
	};
	assert.throws(
		() => getHandbookEntries(content(version)),
		/Duplicate.*same/
	);
	version.docs.pop();
	assert.throws(
		() => getHandbookEntries(content(version)),
		/missing document "second"/
	);
	assert.throws(
		() => getHandbookEntries({}),
		/current docs version is missing/
	);
});

test('build hooks publish the manifest and matching redirects without hook ordering dependencies', async (t) => {
	const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-manifest-'));
	t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
	const guide = doc('main/guide', '/guide');
	const allContent = content({
		versionName: 'current',
		docs: [guide],
		sidebars: { main: [link(guide)] },
	});
	fs.mkdirSync(path.join(outDir, 'guide'));
	fs.writeFileSync(
		path.join(outDir, 'guide', 'index.html'),
		'<p>Original</p>'
	);
	const props = {
		outDir,
		i18n: { currentLocale: 'en', defaultLocale: 'en' },
	};
	const plugins = [redirectDocs(props), generateManifest(props)];
	for (const plugin of plugins) {
		plugin.allContentLoaded({ allContent });
	}
	await Promise.all(plugins.map((plugin) => plugin.postBuild(props)));
	const manifestFile = path.join(outDir, 'manifest.json');
	const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
	assert.equal(
		manifest.guide.markdown_source,
		'https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/docs/main/guide.md'
	);
	assert.match(
		fs.readFileSync(path.join(outDir, 'guide', 'index.html'), 'utf8'),
		/https:\/\/developer.wordpress.org\/playground\/handbook\/guide\//
	);
	const original = fs.readFileSync(manifestFile, 'utf8');
	const localized = generateManifest({
		i18n: { currentLocale: 'fr', defaultLocale: 'en' },
	});
	localized.allContentLoaded({ allContent: {} });
	await localized.postBuild({ outDir });
	assert.equal(fs.readFileSync(manifestFile, 'utf8'), original);
});

function doc(id, slug) {
	return {
		id,
		slug,
		title: id,
		source: `@site/docs/${id}.md`,
		frontMatter: {},
	};
}

function link(document) {
	return { type: 'doc', id: document.id };
}

function category(document, items) {
	return {
		type: 'category',
		label: document.title,
		link: link(document),
		items,
	};
}

function content(version) {
	return {
		'docusaurus-plugin-content-docs': {
			default: { loadedVersions: [version] },
		},
	};
}
