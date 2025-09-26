#!/usr/bin/env node
/**
 * Test version of PR report using sample data
 */

// Sample data from GitHub search results
const samplePRs = [
	{
		id: 3453402936,
		number: 2683,
		title: "[i18n] Add Japanese translations to Playground CLI",
		labels: [
			{ name: "[Aspect] Internationalization (i18n)" }
		],
		user: { login: "shimotmk" },
		pull_request: { merged_at: "2025-09-26T09:39:22Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2683"
	},
	{
		id: 3453204668,
		number: 2682,
		title: "Playground CLI: Log unhandled rejections and stop them from crashing workers",
		labels: [
			{ name: "[Type] Bug" },
			{ name: "[Package][@wp-playground] CLI" }
		],
		user: { login: "brandonpayton" },
		pull_request: { merged_at: "2025-09-25T21:01:34Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2682"
	},
	{
		id: 3451127452,
		number: 2681,
		title: "[CLI] Polyfill the Buffer class without making it an empty object in CLI",
		labels: [
			{ name: "[Type] Bug" },
			{ name: "[Package][@wp-playground] Storage" },
			{ name: "[Package][@wp-playground] CLI" }
		],
		user: { login: "adamziel" },
		pull_request: { merged_at: "2025-09-25T09:06:09Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2681"
	},
	{
		id: 3450967805,
		number: 2680,
		title: "[i18n] Add French translation for resources.md",
		labels: [
			{ name: "[Type] Documentation" },
			{ name: "[Aspect] Internationalization (i18n)" }
		],
		user: { login: "beryl-dlg" },
		pull_request: { merged_at: "2025-09-26T09:31:55Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2680"
	},
	{
		id: 3450153162,
		number: 2679,
		title: "[Website] Disable curl_share_init by default (to make Composer work)",
		labels: [
			{ name: "[Type] Enhancement" },
			{ name: "[Aspect] Networking" },
			{ name: "[Package][@wp-playground] Website" }
		],
		user: { login: "adamziel" },
		pull_request: { merged_at: "2025-09-24T17:00:19Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2679"
	},
	{
		id: 3446731618,
		number: 2677,
		title: "[Blueprints] Replace randomString() with randomFilename() in installAsset()",
		labels: [
			{ name: "[Type] Bug" },
			{ name: "[Package][@wp-playground] Blueprints" }
		],
		user: { login: "adamziel" },
		pull_request: { merged_at: "2025-09-23T22:15:50Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2677"
	},
	{
		id: 3445760170,
		number: 2675,
		title: "[Website] Resolve the Blueprint declaration for the 'View Blueprint' button",
		labels: [
			{ name: "[Type] Enhancement" },
			{ name: "[Package][@wp-playground] Website" }
		],
		user: { login: "adamziel" },
		pull_request: { merged_at: "2025-09-24T16:43:53Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2675"
	},
	{
		id: 3437631942,
		number: 2666,
		title: "[Docs] Adding steps to translate docs with GitHub UI",
		labels: [
			{ name: "[Type] Documentation" }
		],
		user: { login: "fellyph" },
		pull_request: { merged_at: "2025-09-23T17:36:31Z" },
		html_url: "https://github.com/WordPress/wordpress-playground/pull/2666"
	}
];

type IssuesListForRepoResponseItem = any;

/**
 * Determines the feature category for a PR based on title and labels
 * Priority order: i18n, XDebug, Blueprints, Docs, CLI, Website
 */
function getFeatureCategory(issue: IssuesListForRepoResponseItem): string | null {
	const title = issue.title.toLowerCase();
	const labels = issue.labels.map((label: any) => label.name.toLowerCase());
	const text = `${title} ${labels.join(' ')}`;
	
	// Priority order - more specific categories first
	const priorityOrder = [
		// i18n has highest priority - very specific
		['i18n', 'internationalization', 'translation', 'translations', 'localization', 'locale', 'tagalog', 'portuguese', 'gujarati', 'japanese', 'pt-br', 'french'],
		// XDebug - specific debugging feature
		['xdebug', 'x-debug', 'xdebug bridge'],
		// Blueprints - specific feature
		['blueprint', 'blueprints', '@wp-playground/blueprints', 'blueprint builder', 'blueprint data'],
		// Docs - documentation related
		['doc', 'docs', 'documentation', 'readme', 'guide', 'tutorial'],
		// CLI - command line interface
		['cli', 'command line', 'wp-now', '@wp-playground/cli', 'playground cli'],
		// Website - broader category
		['website', '@wp-playground/website', 'playground website', 'web', 'ui', 'ux', 'frontend'],
	];
	
	const categoryMap = ['i18n', 'XDebug', 'Blueprints', 'Docs', 'CLI', 'Website'];
	
	for (let i = 0; i < priorityOrder.length; i++) {
		const patterns = priorityOrder[i];
		for (const pattern of patterns) {
			if (text.includes(pattern)) {
				return categoryMap[i];
			}
		}
	}
	
	return null;
}

/**
 * Groups PRs by feature categories
 */
function groupPRsByFeature(prs: IssuesListForRepoResponseItem[]): Record<string, IssuesListForRepoResponseItem[]> {
	const groups: Record<string, IssuesListForRepoResponseItem[]> = {
		'CLI': [],
		'Website': [],
		'XDebug': [],
		'Blueprints': [],
		'Docs': [],
		'i18n': [],
		'Other': [],
	};

	for (const pr of prs) {
		const category = getFeatureCategory(pr);
		if (category && groups[category]) {
			groups[category].push(pr);
		} else {
			groups['Other'].push(pr);
		}
	}

	return groups;
}

/**
 * Formats a PR for display
 */
function formatPR(pr: IssuesListForRepoResponseItem): string {
	const title = pr.title;
	const number = pr.number;
	const url = pr.html_url;
	const author = pr.user.login;
	const mergedAt = new Date(pr.pull_request.merged_at).toLocaleDateString();
	
	return `- ${title} ([#${number}](${url})) by @${author} - ${mergedAt}`;
}

/**
 * Generates the report
 */
function generateReport(
	groupedPRs: Record<string, IssuesListForRepoResponseItem[]>,
	fromDate: string,
	toDate: string
): string {
	const totalPRs = Object.values(groupedPRs).reduce((sum, prs) => sum + prs.length, 0);
	
	let report = `# Pull Request Report\n\n`;
	report += `**Date Range:** ${fromDate} to ${toDate}\n`;
	report += `**Total PRs:** ${totalPRs}\n\n`;
	
	const categories = ['CLI', 'Website', 'XDebug', 'Blueprints', 'Docs', 'i18n'];
	
	for (const category of categories) {
		const prs = groupedPRs[category] || [];
		report += `## [${category}] (${prs.length} PRs)\n\n`;
		
		if (prs.length === 0) {
			report += `No pull requests found for this category.\n\n`;
		} else {
			for (const pr of prs) {
				report += formatPR(pr) + '\n';
			}
			report += '\n';
		}
	}
	
	// Include Other category if it has PRs
	const otherPRs = groupedPRs['Other'] || [];
	if (otherPRs.length > 0) {
		report += `## Other (${otherPRs.length} PRs)\n\n`;
		for (const pr of otherPRs) {
			report += formatPR(pr) + '\n';
		}
		report += '\n';
	}
	
	return report;
}

// Generate report
const groupedPRs = groupPRsByFeature(samplePRs);
const report = generateReport(groupedPRs, '2025-09-19', '2025-09-26');

console.log(report);

// Summary
console.log('📈 Summary:');
const categories = ['CLI', 'Website', 'XDebug', 'Blueprints', 'Docs', 'i18n', 'Other'];
for (const category of categories) {
	const count = groupedPRs[category]?.length || 0;
	if (count > 0) {
		console.log(`  ${category}: ${count} PRs`);
	}
}