/**
 * Updates a CHANGELOG.md file to reflect the changes in the current release.
 *
 * It merges the new changes with the existing changelog, either replacing the
 * release section, the "Unreleased" section, or prepending a new section when
 * appropriate.
 *
 * Usage:
 *
 * ```shell
 * bun ./packages/meta/bin/update-changelog.ts --version=current
 * ```
 */

import fs from 'fs';
import { getReleaseChangelog } from '../src/changelog';
import lernaConfig from '../../../lerna.json';

const args = process.argv.slice(2);
const outfile =
	args.find((arg) => arg.startsWith('--outfile='))?.split('=')[1] ||
	'CHANGELOG.md';
let version = args.find((arg) => arg.startsWith('--version='))?.split('=')[1];

if (version === 'current') {
	version = lernaConfig.version;
}
if (version === 'unreleased') {
	version = undefined;
}

if (!outfile) {
	console.error(
		'Usage: bun ./packages/meta/bin/update-changelog.ts --outfile=path/to/changelog.md --version=[1.0.0|current|unreleased]'
	);
	process.exit(1);
}

const existingChangelog = fs.existsSync(outfile)
	? fs.readFileSync(outfile, 'utf8')
	: '';

type VersionDetails = {
	line: string;
	version?: string;
	lineIndex: number;
};

const newChanges = await getReleaseChangelog({
	token: process.env.GITHUB_TOKEN,
	version,
});

const merged = mergeChangelogs(
	existingChangelog,
	newChanges,
	version || 'Unreleased'
);

fs.writeFileSync(outfile, merged);

console.log(
	`${outfile} updated with changes for version "${version || 'unreleased'}"`
);

function mergeChangelogs(
	existing: string,
	newChanges: string,
	newVersion: string
) {
	const existingLines = existing.split('\n');
	const existingVersions = parseChangelog(existingLines);

	const lastVersion = existingVersions[0].version;
	const previousVersion = existingVersions[1]?.version;

	let newLines: string[];
	const versionToReplace =
		previousVersion && previousVersion === newVersion
			? previousVersion
			: lastVersion === 'Unreleased' || lastVersion === newVersion
			? lastVersion
			: undefined;

	if (versionToReplace) {
		newLines = replaceVersion(
			versionToReplace,
			existingLines,
			existingVersions,
			newChanges
		);
	} else {
		newLines = addNewVersion(existingLines, existingVersions, newChanges);
	}

	return newLines.join('\n');
}

function replaceVersion(
	version: string,
	changelogLines: string[],
	parsedVersions: VersionDetails[],
	newContent: string
) {
	let versionStartsAt: number | undefined;
	let versionEndsAt: number | undefined = changelogLines.length - 1;
	for (const parsedVersion of parsedVersions) {
		if (parsedVersion.version === version) {
			versionStartsAt = parsedVersion.lineIndex;
		} else if (versionStartsAt !== undefined) {
			versionEndsAt = parsedVersion.lineIndex - 1;
			break;
		}
	}
	if (versionStartsAt === undefined) {
		throw new Error(`Version ${version} not found in changelog`);
	}

	return [
		...changelogLines.slice(0, versionStartsAt),
		...newContent.split('\n'),
		'',
		'',
		...changelogLines.slice(versionEndsAt + 1),
	];
}

function addNewVersion(
	changelogLines: string[],
	parsedVersions: VersionDetails[],
	newContent: string
) {
	const lastVersionIndex = parsedVersions[0].lineIndex;
	const newLines = newContent.split('\n');
	const newChangelogLines = [...changelogLines];
	newChangelogLines.splice(lastVersionIndex, 0, ...newLines, '', '');
	return newChangelogLines;
}

function parseChangelog(changelogLines: string[]) {
	let index = 0;
	const lastThreeDocumentedVersions: VersionDetails[] = [];
	for (const line of changelogLines) {
		if (line.startsWith('## ')) {
			lastThreeDocumentedVersions.push({
				line: line,
				version: line.match(/(Unreleased|\d+\.\d+\.\d+)/)?.[1],
				lineIndex: index,
			});
		}
		if (lastThreeDocumentedVersions.length === 3) {
			break;
		}
		++index;
	}
	return lastThreeDocumentedVersions;
}
