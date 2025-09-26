#!/usr/bin/env node
/**
 * Generates a report with completed Pull requests from a specific date range,
 * grouped by features: [CLI], [Website], [XDebug], [Blueprints], [Docs], [i18n]
 *
 * Usage:
 *
 * ```shell
 * npx tsx packages/meta/bin/pr-report.ts --from=2025-09-19 --to=2025-09-26 --token=<github-token>
 * ```
 */

import { Octokit } from '@octokit/rest';
import { config } from '../src/config';

const args = process.argv.slice(2);
const fromDate = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
const toDate = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];
const token = args.find((arg) => arg.startsWith('--token='))?.split('=')[1] || process.env.GITHUB_TOKEN;
const outfile = args.find((arg) => arg.startsWith('--outfile='))?.split('=')[1];

if (!fromDate || !toDate) {
	console.error(
		'Usage: npx tsx packages/meta/bin/pr-report.ts --from=YYYY-MM-DD --to=YYYY-MM-DD [--token=github-token] [--outfile=path/to/output.md]'
	);
	process.exit(1);
}

if (!token) {
	console.error('GitHub token is required. Set GITHUB_TOKEN environment variable or use --token flag');
	process.exit(1);
}



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
		// Blueprints - specific feature (be careful not to match "blueprint" in context of website)
		['[package][@wp-playground] blueprints', '[blueprints]', 'blueprint builder', 'blueprint data', 'installasset'],
		// Docs - documentation related
		['[type] documentation', 'doc', 'docs', 'documentation', 'readme', 'guide', 'tutorial'],
		// CLI - command line interface
		['[package][@wp-playground] cli', '[cli]', 'playground cli', 'command line', 'wp-now'],
		// Website - broader category
		['[package][@wp-playground] website', '[website]', 'playground website', 'ui', 'ux', 'frontend'],
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
 * Fetches merged PRs within the specified date range
 */
async function fetchPRsInDateRange(
	octokit: Octokit,
	owner: string,
	repo: string,
	fromDate: string,
	toDate: string
): Promise<IssuesListForRepoResponseItem[]> {
	const options = octokit.issues.listForRepo.endpoint.merge({
		owner,
		repo,
		state: 'closed',
		since: fromDate,
		sort: 'updated',
		per_page: 100,
	});

	const responses = octokit.paginate.iterator(options);
	let prs: any[] = [];

	for await (const response of responses) {
		const issues = response.data as any;
		prs.push(...issues);
	}

	// Filter to only merged PRs within the date range
	const fromTimestamp = new Date(fromDate);
	const toTimestamp = new Date(toDate + 'T23:59:59Z'); // End of day
	
	prs = prs.filter((pr) => {
		// Only include PRs (not issues)
		if (!pr.pull_request?.merged_at) return false;
		
		const mergedAt = new Date(pr.pull_request.merged_at);
		return mergedAt >= fromTimestamp && mergedAt <= toTimestamp;
	});

	return prs;
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

/**
 * Main function
 */
async function main() {
	console.log(`🔍 Fetching PRs from ${fromDate} to ${toDate}...`);
	
	const octokit = new Octokit({
		auth: token,
	});

	try {
		const prs = await fetchPRsInDateRange(
			octokit,
			'WordPress',
			'wordpress-playground',
			fromDate,
			toDate
		);

		console.log(`📊 Found ${prs.length} merged PRs in the date range`);

		const groupedPRs = groupPRsByFeature(prs);
		const report = generateReport(groupedPRs, fromDate, toDate);

		if (outfile) {
			const fs = await import('fs');
			fs.writeFileSync(outfile, report);
			console.log(`📄 Report saved to ${outfile}`);
		} else {
			console.log('\n' + report);
		}

		// Summary
		console.log('\n📈 Summary:');
		const categories = ['CLI', 'Website', 'XDebug', 'Blueprints', 'Docs', 'i18n', 'Other'];
		for (const category of categories) {
			const count = groupedPRs[category]?.length || 0;
			if (count > 0) {
				console.log(`  ${category}: ${count} PRs`);
			}
		}

	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

main().catch(console.error);