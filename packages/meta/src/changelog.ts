/**
 * Adapted from Gutenberg changelog.js at
 *
 * https://github.com/WordPress/gutenberg/blob/2dff99b899834c925d9e9fe43f6c546082fcb8c0/bin/plugin/commands/changelog.js
 *
 * This script generated a changelog based on GitHub PRs merged since
 * the last tagged version.
 */

/**
 * External dependencies
 */
import { Octokit } from '@octokit/rest';
import semver from 'semver';

/**
 * Internal dependencies
 */
import { config } from './config';

/**
 * Follow the WordPress version guidelines to compute
 * the version to be used By default, increase the "minor"
 * number but if we reach 9, bump to the next major.
 *
 * @param version Current version.
 * @return Next Major Version.
 */
function getNextMajorVersion(version: string): string {
	const [major, minor] = version.split('.').map(Number);
	if (minor === 9) {
		return `${major + 1}.0.0`;
	}
	return `${major}.${minor + 1}.0`;
}

/**
 * Returns a promise resolving to pull requests by a given milestone ID.
 *
 * @param octokit Initialized Octokit REST client.
 * @param owner Repository owner.
 * @param repo Repository name.
 * @param milestone Milestone ID.
 * @param state Optional issue state.
 * @param closedAfter Optional timestamp.
 *
 * @return Pull requests for the given milestone.
 */
async function getIssues(
	octokit: Octokit,
	owner: any,
	repo: any,
	state: 'open' | 'closed' | 'all' | undefined,
	closedAfter: string,
	closedBefore?: string
) {
	const options = octokit.issues.listForRepo.endpoint.merge({
		owner,
		repo,
		state,
		since: closedAfter,
	});

	const responses = octokit.paginate.iterator(options);

	let pulls: any[] = [];

	for await (const response of responses) {
		const issues = response.data as any;
		pulls.push(...issues);
	}
	if (closedAfter) {
		const closedAfterTimestamp = new Date(closedAfter);

		pulls = pulls.filter(
			(pull) =>
				pull.closed_at &&
				closedAfterTimestamp < new Date(pull.closed_at)
		);
	}
	if (closedBefore) {
		const closedBeforeTimestamp = new Date(closedBefore);

		pulls = pulls.filter(
			(pull) =>
				pull.closed_at &&
				closedBeforeTimestamp > new Date(pull.closed_at)
		);
	}

	pulls = pulls.filter((pull) => pull.pull_request?.merged_at);

	return pulls;
}

const UNKNOWN_FEATURE_FALLBACK_NAME = 'Uncategorized';

/**
 * Options for the WPChangelogCommand.
 */
type WPChangelogCommandOptions = {
	version?: string;
	token?: string;
	unreleased?: boolean;
};

/**
 * Settings for the WPChangelog.
 */
type WPChangelogSettings = {
	owner: string;
	repo: string;
	token?: string;
	version?: string;
	unreleased?: boolean;
};

/**
 * Changelog normalization function, returning a string to use as title, or
 * undefined if entry should be omitted.
 */

/**
 * Mapping of label names to sections in the release notes.
 *
 * Labels are sorted by the priority they have when there are
 * multiple candidates. For example, if an issue has the labels
 * "[Block] Navigation" and "[Type] Bug", it'll be assigned the
 * section declared by "[Block] Navigation".
 */
const LABEL_TYPE_MAPPING: Record<string, string> = {
	'Breaking change': '**Breaking Changes**',
	'[Feature] GitHub integration': 'Tools',
	'[Feature] Import Export': 'Tools',
	'[Feature] OPFS': 'Experiments',
	'[Feature] PHP.wasm': 'PHP WebAssembly',
	'[Feature] Plugin proxy': 'Website',
	'[Feature] PR Previewer': 'Tools',
	'[Feature] Blueprints Builder': 'Tools',
	'[Feature] Transfer/ Sync Procotol': 'Experiments',
	'[Package][@php-wasm] CLI': 'Tools',
	'[Package][@php-wasm] Compile': 'PHP WebAssembly',
	'[Package][@php-wasm] FS Journal': 'PHP WebAssembly',
	'[Package][@php-wasm] Logger': 'Reliability',
	'[Package][@php-wasm] Node Polyfills': 'Reliability',
	'[Package][@php-wasm] Node': 'PHP WebAssembly',
	'[Package][@php-wasm] Progress': 'Internal',
	'[Package][@php-wasm] Scopes': 'Internal',
	'[Package][@php-wasm] Stream Compression': 'Experiments',
	'[Package][@php-wasm] Universal': 'PHP WebAssembly',
	'[Package][@php-wasm] Util': 'Internal',
	'[Package][@php-wasm] Web': 'PHP WebAssembly',
	'[Package][@wp-playground] Blueprints': 'Blueprints',
	'[Package][@wp-playground] Client': 'Public API',
	'[Package][@wp-playground] Remote': 'Website',
	'[Package][@wp-playground] Storage': 'Experiments',
	'[Package][@wp-playground] Sync': 'Experiments',
	'[Package][@wp-playground] Website': 'Website',
	'[Package][@wp-playground] WordPress': 'Website',
	'[Focus] Design tools': 'Tools',
	'[Focus] Developer Tools': 'Tools',
	'[Focus] Windows Support': 'Reliability',
	'[Type] Bug': 'Bug Fixes',
	'[Type] Community': 'Devrel',
	'[Type] Developer Documentation': 'Documentation',
	'[Type] Developer Experience': '',
	'[Type] Devrel': 'Devrel',
	'[Type] Discussion': 'Devrel',
	'[Type] Documentation': 'Documentation',
	'[Type] Enhancement': 'Enhancements',
	'[Type] Exploration': 'Experiments',
	'[Type] Marketing': 'Devrel',
	'[Type] New API': 'New APIs',
	'[Type] Performance': 'Performance',
	'[Type] Reliability': 'Reliability',
	'[Type] Repo / Project Management': 'Internal',
	'[Type] UI / UX / User Experience': 'User Experience',
	'[Aspect] Asyncify': 'PHP WebAssembly',
	'[Aspect] Browser': 'Website',
	'[Aspect] Networking': 'PHP WebAssembly',
	'[Aspect] Node.js': 'PHP WebAssembly',
	'[Aspect] Privacy Sandbox': 'Reliability',
	'[Aspect] Service Worker': 'Website',
	'[Aspect] Website': 'Website',
};

/**
 * Mapping of label names to arbitary features in the release notes.
 *
 * Mapping a given label to a feature will guarantee it will be categorised
 * under that feature name in the changelog within each section.
 */
const LABEL_FEATURE_MAPPING: Record<string, string> = {
	'Breaking change': '**Breaking Changes**',
	'[Feature] GitHub integration': 'GitHub integration',
	'[Feature] Import Export': 'Import/Export',
	'[Feature] OPFS': 'File Synchronization',
	'[Feature] PHP.wasm': 'PHP WebAssembly',
	'[Feature] PR Previewer': 'Pull Request Previewer',
	'[Feature] Blueprints Builder': 'Blueprints Builder',
	'[Package][@php-wasm] Compile': 'PHP WebAssembly',
	'[Package][@php-wasm] FS Journal': 'PHP WebAssembly',
	'[Package][@php-wasm] Node': 'PHP WebAssembly',
	'[Package][@php-wasm] Universal': 'PHP WebAssembly',
	'[Package][@php-wasm] Web': 'PHP WebAssembly',
	'[Package][@wp-playground] Blueprints': 'Blueprints',
	'[Package][@wp-playground] Client': 'Blueprints',
	'[Package][@wp-playground] Storage': 'GitHub integration',
	'[Package][@wp-playground] Remote': 'Website',
	'[Package][@wp-playground] Website': 'Website',
	'[Package][@wp-playground] WordPress': 'Website',
	'[Type] Developer Documentation': 'Documentation',
};

/**
 * Order in which to print group titles. A value of `undefined` is used as slot
 * in which unrecognized headings are to be inserted.
 */
const GROUP_TITLE_ORDER: Array<string | undefined> = [
	'**Breaking Changes**',
	'Enhancements',
	'New APIs',
	'Blueprints',
	'Public API',
	'Tools',
	'Devrel',
	'Documentation',
	'Experiments',
	'PHP WebAssembly',
	'Website',
	'Internal',
	'Bug Fixes',
	'Reliability',
	'Performance',
	'User Experience',
	undefined,
	'Various',
];

/**
 * Mapping of patterns to match a title to a grouping type.
 */
const TITLE_TYPE_PATTERNS: Map<RegExp, string> = new Map([
	[/^(\w+:)?(bug)?\s*fix(es)?(:|\/ )?/i, 'Bug Fixes'],
]);

/**
 * Map of common technical terms to a corresponding replacement term more
 * appropriate for release notes.
 */
const REWORD_TERMS: Record<string, string> = {
	e2e: 'end-to-end',
	url: 'URL',
	config: 'configuration',
	docs: 'documentation',
};

/**
 * Creates a pipe function. Performs left-to-right function composition, where
 * each successive invocation is supplied the return value of the previous.
 *
 * @param functions Functions to pipe.
 */
function pipe(functions: Function[]) {
	return (/** @type {unknown[]} */ ...args: unknown[]) => {
		return functions.reduce((prev, func) => [func(...prev)], args)[0];
	};
}

/**
 * Escapes the RegExp special characters.
 *
 * @param string Input string.
 *
 * @return Regex-escaped string.
 */
function escapeRegExp(string: string): string {
	return string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

/**
 * Returns candidates based on whether the given labels
 * are part of the allowed list.
 *
 * @param labels Label names.
 *
 * @return Type candidates.
 */
function getTypesByLabels(labels: string[]): string[] {
	return [
		...new Set(
			labels
				.filter((label) =>
					Object.keys(LABEL_TYPE_MAPPING)
						.map((currentLabel) => currentLabel.toLowerCase())
						.includes(label.toLowerCase())
				)
				.map((label) => {
					const lowerCaseLabel =
						Object.keys(LABEL_TYPE_MAPPING).find(
							(key) => key.toLowerCase() === label.toLowerCase()
						) || label;

					return LABEL_TYPE_MAPPING[lowerCaseLabel];
				})
		),
	];
}

/**
 * Returns candidates by retrieving the appropriate mapping
 * from the label -> feature lookup.
 *
 * @param labels Label names.
 *
 * @return Feature candidates.
 */
function mapLabelsToFeatures(labels: string[]): string[] {
	return [
		...new Set(
			labels
				.filter((label) =>
					Object.keys(LABEL_FEATURE_MAPPING)
						.map((currentLabel) => currentLabel.toLowerCase())
						.includes(label.toLowerCase())
				)
				.map((label) => {
					const lowerCaseLabel =
						Object.keys(LABEL_FEATURE_MAPPING).find(
							(key) => key.toLowerCase() === label.toLowerCase()
						) || label;

					return LABEL_FEATURE_MAPPING[lowerCaseLabel];
				})
		),
	];
}

/**
 * Returns whether not the given labels contain the block specific
 * label "block library".
 *
 * @param labels Label names.
 *
 * @return whether or not the issue's is labbeled as block specific
 */
function getIsBlockSpecificIssue(labels: string[]): boolean {
	return !!labels.find((label) => label.startsWith('[Block] '));
}

/**
 * Returns the first feature specific label from the given labels.
 *
 * @param labels Label names.
 *
 * @return the feature specific label.
 */
function getFeatureSpecificLabels(labels: string[]): string | undefined {
	return labels.find((label) => label.startsWith('[Feature] '));
}

/**
 * Returns type candidates based on given issue title.
 *
 * @param title Issue title.
 *
 * @return Type candidates.
 */
function getTypesByTitle(title: string): string[] {
	const types: string[] = [];
	for (const [pattern, type] of TITLE_TYPE_PATTERNS.entries()) {
		if (pattern.test(title)) {
			types.push(type);
		}
	}

	return types;
}

type IssuesListForRepoResponseItem = any;
/**
 * Returns a type label for a given issue object, or a default if type cannot
 * be determined.
 *
 * @param issue Issue object.
 *
 * @return Type label.
 */
function getIssueType(issue: any): string {
	const labels = issue.labels.map(({ name }) => name);

	const candidates = [
		...getTypesByLabels(labels),
		...getTypesByTitle(issue.title),
	];

	return candidates.length ? candidates.sort(sortType)[0] : 'Various';
}

/**
 * Returns the most appropriate feature category for the given issue based
 * on a basic heuristic.
 *
 * @param issue Issue object.
 *
 * @return the feature name.
 */
function getIssueFeature(issue: IssuesListForRepoResponseItem): string {
	const labels = issue.labels.map(({ name }) => name);

	const featureCandidates = mapLabelsToFeatures(labels);

	// 1. Prefer explicit mapping of label to feature.
	if (featureCandidates.length) {
		// Get occurances of the feature labels.
		const featureCounts = featureCandidates.reduce(
			/**
			 * @param {Record<string,number>} acc     Accumulator
			 * @param                feature Feature label
			 */
			(acc: Record<string, number>, feature: string) => ({
				...acc,
				[feature]: (acc[feature] || 0) + 1,
			}),
			{}
		);

		// Check which matching label occurs most often.
		const rankedFeatures = Object.keys(featureCounts).sort(
			(a, b) => featureCounts[b] - featureCounts[a]
		);

		// Return the one that appeared most often.
		return rankedFeatures[0];
	}

	// 2. `[Feature]` labels.
	const featureSpecificLabel = getFeatureSpecificLabels(labels);

	if (featureSpecificLabel) {
		return removeFeaturePrefix(featureSpecificLabel);
	}

	// 3. Block specific labels.
	const blockSpecificLabels = getIsBlockSpecificIssue(labels);

	if (blockSpecificLabels) {
		return 'Block Library';
	}

	// Fallback - if we couldn't find a good match.
	return UNKNOWN_FEATURE_FALLBACK_NAME;
}

/**
 * Sort comparator, comparing two label candidates.
 *
 * @param a First candidate.
 * @param b Second candidate.
 *
 * @return {number} Sort result.
 */
function sortType(a: string, b: string): number {
	const [aIndex, bIndex] = [a, b].map((title) => {
		return Object.values(LABEL_TYPE_MAPPING).indexOf(title);
	});

	return aIndex - bIndex;
}

/**
 * Sort comparator, comparing two group titles.
 *
 * @param a First group title.
 * @param b Second group title.
 *
 * @return {number} Sort result.
 */
function sortGroup(a: string, b: string): number {
	const [aIndex, bIndex] = [a, b].map((title) => {
		const index = GROUP_TITLE_ORDER.indexOf(title);
		return index === -1 ? GROUP_TITLE_ORDER.indexOf(undefined) : index;
	});

	return aIndex - bIndex;
}

/**
 * Given a text string, appends a period if not already ending with one.
 *
 * @param text Original text.
 *
 * @return Text with trailing period.
 */
function addTrailingPeriod(text: string): string {
	return text.replace(/\s*\.?$/, '') + '.';
}

/**
 * Given a text string, replaces reworded terms.
 *
 * @param text Original text.
 *
 * @return Text with reworded terms.
 */
function reword(text: string): string {
	for (const [term, replacement] of Object.entries(REWORD_TERMS)) {
		const pattern = new RegExp(
			'(^| )' + escapeRegExp(term) + '( |$)',
			'ig'
		);
		text = text.replace(pattern, '$1' + replacement + '$2');
	}

	return text;
}

/**
 * Given a text string, capitalizes the first letter of the last segment
 * following a colon.
 *
 * @param text Original text.
 *
 * @return Text with capitalizes last segment.
 */
function capitalizeAfterColonSeparatedPrefix(text: string): string {
	const parts = text.split(':');
	parts[parts.length - 1] = parts[parts.length - 1].replace(
		/^(\s*)([a-z])/,
		(_match, whitespace, letter) => whitespace + letter.toUpperCase()
	);

	return parts.join(':');
}

type WPChangelogNormalization = (
	text: string,
	issue: IssuesListForRepoResponseItem
) => string | undefined;

/**
 * Higher-order function which returns a normalization function to omit by title
 * prefix matching any of the given prefixes.
 *
 * @param prefixes Prefixes from which to determine if given entry
 *                            should be omitted.
 *
 * @return Normalization function.
 */
const createOmitByTitlePrefix =
	(prefixes: string[]): WPChangelogNormalization =>
	(title) =>
		prefixes.some((prefix) =>
			new RegExp('^' + escapeRegExp(prefix), 'i').test(title)
		)
			? undefined
			: title;

/**
 * Higher-order function which returns a normalization function to omit by issue
 * label matching any of the given label names.
 *
 * @param labels Label names from which to determine if given entry
 *                          should be omitted.
 *
 * @return Normalization function.
 */
const createOmitByLabel =
	(labels: string[]): WPChangelogNormalization =>
	(text, issue) =>
		issue.labels.some((label) => labels.includes(label.name))
			? undefined
			: text;

/**
 * Higher-order function which returns a normalization function to omit by issue
 * label starting with any of the given prefixes
 *
 * @param prefixes Label prefixes from which to determine if given entry
 *                            should be omitted.
 *
 * @return Normalization function.
 */
const createOmitByLabelPrefix =
	(prefixes: string[]): WPChangelogNormalization =>
	(text, issue) =>
		issue.labels.some((label) =>
			prefixes.some((prefix) => label.name.startsWith(prefix))
		)
			? undefined
			: text;
/**
 * Given an issue title and issue, returns the title with redundant grouping
 * type details removed. The prefix is redundant since it would already be clear
 * enough by group assignment that the prefix would be inferred.
 *
 * @return Title with redundant grouping type details removed.
 */
function removeRedundantTypePrefix(title, issue): string {
	const type = getIssueType(issue);

	return title.replace(
		new RegExp(
			`^\\[?${
				// Naively try to convert to singular form, to match "Bug Fixes"
				// type as either "Bug Fix" or "Bug Fixes" (technically matches
				// "Bug Fixs" as well).
				escapeRegExp(type.replace(/(es|s)$/, ''))
			}(es|s)?\\]?:?\\s*`,
			'i'
		),
		''
	);
}

/**
 * Removes any `[Feature] ` prefix from a given string.
 *
 * @param text The string of text potentially containing a prefix.
 *
 * @return the text without the prefix.
 */
function removeFeaturePrefix(text: string): string {
	return text.replace('[Feature] ', '');
}

/**
 * Array of normalizations applying to title, each returning a new string, or
 * undefined to indicate an entry which should be omitted.
 */
const TITLE_NORMALIZATIONS: Array<WPChangelogNormalization> = [
	createOmitByLabelPrefix(['Mobile App']),
	createOmitByTitlePrefix(['[rnmobile]', '[mobile]', 'Mobile Release']),
	removeRedundantTypePrefix,
	reword,
	capitalizeAfterColonSeparatedPrefix,
	addTrailingPeriod,
];

/**
 * Given an issue title, returns the title with normalization transforms
 * applied, or undefined to indicate that the entry should be omitted.
 *
 * @param                        title Original title.
 * @param issue Issue object.
 *
 * @return Normalized title.
 */
function getNormalizedTitle(
	title: string,
	issue: IssuesListForRepoResponseItem
): string | undefined {
	/** @type */
	let normalizedTitle: string | undefined = title;
	for (const normalize of TITLE_NORMALIZATIONS) {
		normalizedTitle = normalize(normalizedTitle, issue);
		if (normalizedTitle === undefined) {
			break;
		}
	}

	return normalizedTitle;
}

/**
 * Returns a formatted changelog list item entry for a given issue object, or undefined
 * if entry should be omitted.
 *
 * @param issue Issue object.
 *
 * @return Formatted changelog entry, or undefined to omit.
 */
function getEntry(issue: IssuesListForRepoResponseItem): string | undefined {
	const title = getNormalizedTitle(issue.title, issue);

	return title === undefined
		? title
		: '- ' +
				getFormattedItemDescription(
					title,
					issue.number,
					issue.html_url
				);
}

/**
 * Builds a formatted string of the Issue/PR title with a link
 * to the Github URL for that item.
 *
 * @param title  the title of the Issue/PR.
 * @param {number} number the ID/number of the Issue/PR.
 * @param url    the URL of the Github Issue/PR.
 * @return the formatted item
 */
function getFormattedItemDescription(
	title: string,
	number: number,
	url: string
): string {
	return `${title} ([#${number}](${url}))`;
}

/**
 * Returns a formatted changelog entry for a given issue object and matching feature name, or undefined
 * if entry should be omitted.
 *
 * @param issue       Issue object.
 * @param                        featureName Feature name.
 *
 * @return Formatted changelog entry, or undefined to omit.
 */
function getFeatureEntry(
	issue: IssuesListForRepoResponseItem,
	featureName: string
): string | undefined {
	const featureNameRegex = escapeRegExp(featureName.toLowerCase());
	return getEntry(issue)
		?.replace(new RegExp(`\\[${featureNameRegex} \- `, 'i'), '[')
		.replace(new RegExp(`(?<=^- )${featureNameRegex}: `, 'i'), '');
}

async function getPreviousReleaseTag(
	octokit: Octokit,
	owner: string,
	repo: string,
	beforeTag?: string
) {
	const options = octokit.repos.listTags.endpoint.merge({
		owner,
		repo,
	});

	const responses = octokit.paginate.iterator(options);

	let tags: any[] = [];
	for await (const response of responses) {
		tags.push(...response.data);
	}

	tags = tags.filter((tag) => tag.name.startsWith('v'));
	if (beforeTag) {
		tags = tags.filter((tag) => semver.lt(tag.name, beforeTag));
	}
	if (tags.length === 0) {
		throw new Error('Could not find the last release tag.');
	}
	return tags[0];
}

async function getTagCommitDate(
	octokit: Octokit,
	owner: string,
	repo: string,
	tag: string
) {
	const { data: commit } = await octokit.repos.getCommit({
		owner,
		repo,
		ref: tag,
	});
	return commit.commit.committer?.date;
}

/**
 * Returns a promise resolving to an array of pull requests associated with the
 * changelog settings object.
 *
 * @param octokit  GitHub REST client.
 * @param settings Changelog settings.
 */
async function fetchAllPullRequests(
	octokit: Octokit,
	settings: WPChangelogSettings
): Promise<IssuesListForRepoResponseItem[]> {
	const { owner, repo, version, unreleased } = settings;

	let forTag = version;
	if (forTag && !forTag.startsWith('v')) {
		forTag = `v${forTag}`;
	}
	const lastTag = await getPreviousReleaseTag(octokit, owner, repo, forTag);

	const tagDate = async (tag: string) => {
		return await getTagCommitDate(octokit, owner, repo, tag);
	};
	let issuesAfterDate = await tagDate(lastTag.name);
	let issuesBeforeDate = forTag ? await tagDate(forTag) : undefined;

	const issues = await getIssues(
		octokit,
		owner,
		repo,
		'closed',
		issuesAfterDate!,
		issuesBeforeDate
	);

	return issues.filter((issue) => issue.pull_request);
}

/**
 * Formats the changelog string for a given list of pull requests.
 *
 * @param {IssuesListForRepoResponseItem[]} pullRequests List of pull requests.
 *
 * @return The formatted changelog string.
 */
function getChangelog(pullRequests: IssuesListForRepoResponseItem[]): string {
	let changelog = '';
	const groupedPullRequests = skipCreatedByBots(pullRequests).reduce(
		(
			/** @type {Record<string, IssuesListForRepoResponseItem[]>} */ acc: Record<
				string,
				IssuesListForRepoResponseItem[]
			>,
			pr
		) => {
			const issueType = getIssueType(pr);
			if (!acc[issueType]) {
				acc[issueType] = [];
			}
			acc[issueType].push(pr);
			return acc;
		},
		{}
	);

	const sortedGroups = Object.keys(groupedPullRequests).sort(sortGroup);

	for (const group of sortedGroups) {
		const groupPullRequests = groupedPullRequests[group];
		const groupEntries = groupPullRequests.map(getEntry).filter(Boolean);

		if (!groupEntries.length) {
			continue;
		}

		// Start a new section within the changelog.
		changelog += '### ' + group + '\n\n';

		// Group PRs within this section into "Features".
		const featureGroups = groupPullRequests.reduce(
			(
				/** @type {Record<string, IssuesListForRepoResponseItem[]>} */ acc: Record<
					string,
					IssuesListForRepoResponseItem[]
				>,
				pr
			) => {
				const issueFeature = getIssueFeature(pr);
				if (!acc[issueFeature]) {
					acc[issueFeature] = [];
				}
				acc[issueFeature].push(pr);
				return acc;
			},
			{}
		);

		const featuredGroupNames = sortFeatureGroups(featureGroups);

		// Start output of Features within the section.
		featuredGroupNames.forEach((featureName, index) => {
			const featureGroupPRs = featureGroups[featureName];

			const featureGroupEntries = featureGroupPRs
				.map((issue) => getFeatureEntry(issue, featureName))
				.filter(Boolean)
				.sort();

			// Don't create feature sections when there are no PRs.
			if (!featureGroupEntries.length) {
				return;
			}

			// Avoids double nesting such as "Documentation" feature under
			// the "Documentation" section.
			if (
				group !== featureName &&
				featureName !== UNKNOWN_FEATURE_FALLBACK_NAME
			) {
				// Start new <ul> for the Feature group.
				changelog += '\n#### ' + featureName + '\n\n';
			}

			// Add a <li> for each PR in the Feature.
			featureGroupEntries.forEach((entry) => {
				// Add a new bullet point to the list.
				changelog += `${entry}\n`;
			});
		});

		changelog += '\n';
	}

	return changelog;
}

/**
 * Sorts the feature groups by the feature which contains the greatest number of PRs
 * ready for output into the changelog.
 *
 * @param {Object.<string, IssuesListForRepoResponseItem[]>} featureGroups feature specific PRs keyed by feature name.
 * @return sorted list of feature names.
 */
function sortFeatureGroups(featureGroups: {
	[s: string]: IssuesListForRepoResponseItem[];
}): string[] {
	return Object.keys(featureGroups).sort((featureAName, featureBName) => {
		// Sort "uncategorized" items to *always* be at the top of the section.
		if (featureAName === UNKNOWN_FEATURE_FALLBACK_NAME) {
			return -1;
		} else if (featureBName === UNKNOWN_FEATURE_FALLBACK_NAME) {
			return 1;
		}

		// Sort by greatest number of PRs in the group first.
		return (
			featureGroups[featureBName].length -
			featureGroups[featureAName].length
		);
	});
}

/**
 * Returns a list of PRs created by first time contributors based on the Github
 * label associated with the PR. Also filters out any "bots".
 *
 * @param {IssuesListForRepoResponseItem[]} pullRequests List of pull requests.
 *
 * @return {IssuesListForRepoResponseItem[]} pullRequests List of first time contributor PRs.
 */
function getFirstTimeContributorPRs(
	pullRequests: IssuesListForRepoResponseItem[]
): IssuesListForRepoResponseItem[] {
	return pullRequests.filter((pr) => {
		return pr.labels.find(
			({ name }) => name.toLowerCase() === 'first-time contributor'
		);
	});
}

/**
 * Creates a set of markdown formatted list items for each first time contributor
 * and their associated PR.
 *
 * @param {IssuesListForRepoResponseItem[]} ftcPRs List of first time contributor PRs.
 *
 * @return The formatted markdown list of contributors and their PRs.
 */
function getContributorPropsMarkdownList(
	ftcPRs: IssuesListForRepoResponseItem[]
): string {
	return ftcPRs.reduce((markdownList, pr) => {
		const title = getNormalizedTitle(pr.title, pr) || '';

		const formattedTitle = getFormattedItemDescription(
			title,
			pr.number,
			pr.pull_request.html_url
		);

		markdownList +=
			'- ' + '@' + pr.user.login + ': ' + formattedTitle + '\n';
		return markdownList;
	}, '');
}

/**
 * Sorts a given Issue/PR by the username of the user who created.
 *
 * @param {IssuesListForRepoResponseItem[]} items List of pull requests.
 * @return {IssuesListForRepoResponseItem[]} The sorted list of pull requests.
 */
function sortByUsername(
	items: IssuesListForRepoResponseItem[]
): IssuesListForRepoResponseItem[] {
	return [...items].sort((a, b) =>
		a.user.login.toLowerCase().localeCompare(b.user.login.toLowerCase())
	);
}

/**
 * Removes duplicate PRs by the username of the user who created.
 *
 * @param {IssuesListForRepoResponseItem[]} items List of pull requests.
 * @return {IssuesListForRepoResponseItem[]} The list of pull requests unique per user.
 */
function getUniqueByUsername(
	items: IssuesListForRepoResponseItem[]
): IssuesListForRepoResponseItem[] {
	/**
	 * @type {IssuesListForRepoResponseItem[]} List of pull requests.
	 */
	const EMPTY_PR_LIST: IssuesListForRepoResponseItem[] = [];

	return items.reduce((acc, item) => {
		if (!acc.some((i) => i.user.login === item.user.login)) {
			acc.push(item);
		}
		return acc;
	}, EMPTY_PR_LIST);
}

/**
 * Excludes users who should not be included in the changelog.
 * Typically this is "bot" users.
 *
 * @param {IssuesListForRepoResponseItem[]} pullRequests List of pull requests.
 * @return {IssuesListForRepoResponseItem[]} The list of filtered pull requests.
 */
function skipCreatedByBots(
	pullRequests: IssuesListForRepoResponseItem[]
): IssuesListForRepoResponseItem[] {
	return pullRequests.filter((pr) => pr.user.type.toLowerCase() !== 'bot');
}

/**
 * Produces the formatted markdown for the contributor props seciton.
 *
 * @param {IssuesListForRepoResponseItem[]} pullRequests List of pull requests.
 *
 * @return The formatted props section.
 */
function getContributorProps(
	pullRequests: IssuesListForRepoResponseItem[]
): string {
	const contributorsList = pipe([
		skipCreatedByBots,
		getFirstTimeContributorPRs,
		getUniqueByUsername,
		sortByUsername,
		getContributorPropsMarkdownList,
	])(pullRequests);

	if (!contributorsList) {
		return '';
	}

	return (
		'### First time contributors' +
		'\n\n' +
		'The following PRs were merged by first time contributors:' +
		'\n\n' +
		contributorsList
	);
}

/**
 *
 * @param {IssuesListForRepoResponseItem[]} pullRequests List of first time contributor PRs.
 * @return The formatted markdown list of contributor usernames.
 */
function getContributorsMarkdownList(
	pullRequests: IssuesListForRepoResponseItem[]
): string {
	return pullRequests
		.reduce((markdownList = '', pr) => {
			markdownList += ` @${pr.user.login}`;
			return markdownList;
		}, '')
		.trim();
}

/**
 * Produces the formatted markdown for the full time contributors section of
 * the changelog output.
 *
 * @param {IssuesListForRepoResponseItem[]} pullRequests List of pull requests.
 *
 * @return The formatted contributors section.
 */
function getContributorsList(
	pullRequests: IssuesListForRepoResponseItem[]
): string {
	const contributorsList = pipe([
		skipCreatedByBots,
		getUniqueByUsername,
		sortByUsername,
		getContributorsMarkdownList,
	])(pullRequests);

	return (
		'### Contributors' +
		'\n\n' +
		'The following contributors merged PRs in this release:' +
		'\n\n' +
		contributorsList
	);
}

/**
 * Generates and logs changelog for a milestone.
 *
 * @param settings Changelog settings.
 */
async function createChangelog(settings: WPChangelogSettings) {
	console.log(
		`\n💃Preparing changelog for version: "${
			settings.unreleased ? 'Unreleased' : settings.version
		}"\n\n`
	);

	const octokit = new Octokit({
		auth: settings.token,
	});

	let version = settings.version;
	if (version && !version.startsWith('v')) {
		version = `v${version}`;
	}
	let date = '';
	if (version) {
		date = (
			(await getTagCommitDate(
				octokit,
				settings.owner,
				settings.repo,
				version
			)) || ''
		)
			.toString()
			.split('T')[0];
	}

	const headline = `## ${
		version ? `[${version}] (${date})` : 'Unreleased'
	} \n\n`;

	const pullRequests = await fetchAllPullRequests(octokit, settings);
	if (!pullRequests.length) {
		return headline;
	}
	const changelog = getChangelog(pullRequests);
	const contributorProps = getContributorProps(pullRequests);
	const contributorsList = getContributorsList(pullRequests);

	return ''.concat(headline, changelog, contributorProps, contributorsList);
}

/**
 * Command that generates the release changelog.
 *
 * @param options
 */
async function getReleaseChangelog(
	options: Omit<WPChangelogCommandOptions, 'unreleased'>
) {
	return await createChangelog({
		owner: config.githubRepositoryOwner,
		repo: config.githubRepositoryName,
		token: options.token,
		version: options.version,
		unreleased: !options.version,
	});
}

export {
	reword,
	capitalizeAfterColonSeparatedPrefix,
	createOmitByTitlePrefix,
	createOmitByLabel,
	createOmitByLabelPrefix,
	addTrailingPeriod,
	getNormalizedTitle,
	getReleaseChangelog,
	getIssueType,
	getIssueFeature,
	sortGroup,
	getTypesByLabels,
	getTypesByTitle,
	getFormattedItemDescription,
	getContributorProps,
	getContributorsList,
	getChangelog,
	getUniqueByUsername,
	skipCreatedByBots,
	mapLabelsToFeatures,
};
