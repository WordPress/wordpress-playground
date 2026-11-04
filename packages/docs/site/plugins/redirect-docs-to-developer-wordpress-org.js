const fs = require('fs');
// This plugin works with native Node filesystem paths, not Playground paths.
const path = require('path');
const { getHandbookEntries } = require('./generate-handbook-manifest');

const DEVELOPER_WORDPRESS_ORG_PLAYGROUND_URL =
	'https://developer.wordpress.org/playground/';

module.exports = function redirectDocsToDeveloperWordPressOrg({ i18n }) {
	let entries;
	return {
		name: 'redirect-docs-to-developer-wordpress-org',
		allContentLoaded({ allContent }) {
			if (i18n.currentLocale === i18n.defaultLocale) {
				entries = getHandbookEntries(allContent);
			}
		},
		async postBuild({ outDir }) {
			if (i18n.currentLocale !== i18n.defaultLocale) {
				return;
			}

			for (const { key: manifestPath, doc } of entries) {
				const route = addTrailingSlash(doc.slug);
				const outputFilePath = getOutputFilePath(outDir, route);

				if (!fs.existsSync(outputFilePath)) {
					throw new Error(
						`Expected docs page to exist before redirect replacement: ${outputFilePath}`
					);
				}

				fs.writeFileSync(
					outputFilePath,
					createRedirectPage(
						getDeveloperWordPressOrgUrl(manifestPath)
					)
				);
			}
		},
	};
};

function getDeveloperWordPressOrgUrl(manifestPath) {
	if (manifestPath === 'handbook') {
		return DEVELOPER_WORDPRESS_ORG_PLAYGROUND_URL;
	}

	if (
		manifestPath.startsWith('blueprints') ||
		manifestPath.startsWith('developers')
	) {
		return new URL(
			addTrailingSlash(manifestPath),
			DEVELOPER_WORDPRESS_ORG_PLAYGROUND_URL
		).href;
	}

	return new URL(
		addTrailingSlash(`handbook/${manifestPath}`),
		DEVELOPER_WORDPRESS_ORG_PLAYGROUND_URL
	).href;
}

function addTrailingSlash(route) {
	if (route === '/') {
		return route;
	}

	return route.endsWith('/') ? route : `${route}/`;
}

function getOutputFilePath(outDir, route) {
	if (route === '/') {
		return path.join(outDir, 'index.html');
	}

	return path.join(outDir, route, 'index.html');
}

function createRedirectPage(targetUrl) {
	const escapedTargetUrl = escapeHtml(targetUrl);
	const serializedTargetUrl = JSON.stringify(targetUrl);

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Redirecting...</title>
	<link rel="canonical" href="${escapedTargetUrl}">
	<meta http-equiv="refresh" content="0; url=${escapedTargetUrl}">
	<script>
		location.replace(${serializedTargetUrl} + location.search + location.hash);
	</script>
</head>
<body>
	<p>Redirecting to <a href="${escapedTargetUrl}">${escapedTargetUrl}</a>.</p>
</body>
</html>
`;
}

function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (character) => {
		const escapes = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};

		return escapes[character];
	});
}
