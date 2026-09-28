const fs = require('fs');
// This plugin works with native Node filesystem paths, not Playground paths.
const path = require('path');

const DOCS_PLUGIN_CURRENT_PATH = ['docusaurus-plugin-content-docs', 'current'];
const MANIFEST_FILE_NAME = 'translation-availability.json';

module.exports = function generateTranslationAvailability() {
	return {
		name: 'generate-translation-availability',
		async postBuild({ outDir, i18n }) {
			if (i18n.currentLocale !== i18n.defaultLocale) {
				return;
			}

			const siteDir = path.resolve(__dirname, '..');
			const docsDir = path.join(siteDir, 'docs');
			const i18nDir = path.join(siteDir, i18n.path);
			const manifest = createTranslationAvailabilityManifest({
				docsDir,
				i18n,
				i18nDir,
			});

			fs.writeFileSync(
				path.join(outDir, MANIFEST_FILE_NAME),
				`${JSON.stringify(manifest, null, 2)}\n`
			);
		},
	};
};

function createTranslationAvailabilityManifest({ docsDir, i18n, i18nDir }) {
	const sourceDocs = getMarkdownFiles(docsDir);
	const sourceDocSet = new Set(sourceDocs);
	const manifest = {
		locales: {},
		docs: Object.fromEntries(sourceDocs.map((docPath) => [docPath, []])),
	};

	for (const locale of i18n.locales) {
		if (locale === i18n.defaultLocale) {
			continue;
		}

		const localeConfig = i18n.localeConfigs[locale];
		const translatedDocsDir = path.join(
			i18nDir,
			localeConfig.path,
			...DOCS_PLUGIN_CURRENT_PATH
		);
		const translatedDocs = getMarkdownFiles(translatedDocsDir).filter(
			(docPath) => sourceDocSet.has(docPath)
		);

		if (translatedDocs.length === 0) {
			continue;
		}

		manifest.locales[locale] = {
			label: localeConfig.label,
			path: localeConfig.path,
		};

		for (const docPath of translatedDocs) {
			manifest.docs[docPath].push(locale);
		}
	}

	for (const [docPath, locales] of Object.entries(manifest.docs)) {
		if (locales.length === 0) {
			delete manifest.docs[docPath];
		}
	}

	return manifest;
}

function getMarkdownFiles(rootDir) {
	if (!fs.existsSync(rootDir)) {
		return [];
	}

	return getFilesRecursively(rootDir)
		.filter((filePath) => filePath.endsWith('.md'))
		.map((filePath) => toPosixRelativePath(rootDir, filePath))
		.sort();
}

function getFilesRecursively(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dir, entry.name);

		return entry.isDirectory() ? getFilesRecursively(entryPath) : entryPath;
	});
}

function toPosixRelativePath(rootDir, filePath) {
	return path.relative(rootDir, filePath).split(path.sep).join('/');
}
