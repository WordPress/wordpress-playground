import fs from 'fs';
import { type BlueprintV1Declaration } from '@wp-playground/blueprints';
import { runCLI } from '@wp-playground/cli';

// Get --top <number> from command line arguments.
const args = process.argv.slice(2);

// Options.
let plugin_count = 100;
if (args.find((arg) => arg.startsWith('--top='))) {
	const top = args.find((arg) => arg.startsWith('--top='));
	plugin_count = parseInt(top.split('=')[1] ?? plugin_count.toString());
} else if (args.includes('--top')) {
	const top_index = args.findIndex((arg) => arg.startsWith('--top'));
	plugin_count = parseInt(args[top_index + 1] ?? plugin_count.toString());
}

if (!Number.isInteger(plugin_count) || plugin_count <= 0) {
	console.error('Invalid plugin count. Please, specify a positive integer.');
	process.exit(1);
}

const max_attempts = 3;
const debug = false;
const tmp_dir = `${import.meta.dirname}/tmp`;

// Types.
type Plugin = {
	name: string;
	slug: string;
	tested: string;
	requires_php: string;
	requires_plugins: string[];
};

console.log(`Testing top ${plugin_count} plugins...\n`);

// Construct the top plugins URL.
const base_url = 'https://api.wordpress.org/plugins/info/1.2/';
const url = new URL(base_url);
url.searchParams.set('action', 'query_plugins');
url.searchParams.set('request[browse]', 'popular');

// Fetch the top plugins.
const plugins: Plugin[] = [];
const per_page = Math.min(plugin_count, 250);
const pages = Math.ceil(plugin_count / per_page);

for (let page = 1; page <= pages; page++) {
	url.searchParams.set('request[per_page]', per_page.toString());
	url.searchParams.set('request[page]', page.toString());
	const response = await fetch(url, {
		headers: { Accept: 'application/json' },
	});
	const data = await response.json();
	plugins.push(...data.plugins.slice(0, plugin_count - plugins.length));
}

// Run plugin tests.
const results: { plugin: Plugin; error?: string }[] = [];
for await (const [i, plugin] of plugins.entries()) {
	process.stdout.write(`[${i + 1}] ${plugin.slug}... `);

	let php_version = plugin.requires_php;
	if (php_version < '7.4') {
		php_version = '7.4';
	} else if (php_version > '8.4') {
		php_version = '8.4';
	}

	const blueprint: BlueprintV1Declaration = {
		preferredVersions: {
			php: php_version as BlueprintV1Declaration['preferredVersions']['php'],
			wp: plugin.tested ?? 'latest',
		},
		login: true,
		steps: [
			{
				step: 'defineWpConfigConsts',
				consts: {
					WP_AUTO_UPDATE_CORE: false,
					DISABLE_WP_CRON: true,
				},
			},
			...plugin.requires_plugins.map(
				(slug) =>
					({
						step: 'installPlugin',
						pluginData: {
							resource: 'wordpress.org/plugins',
							slug,
						},
						options: {
							activate: true,
						},
					} as const)
			),
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: plugin.slug,
				},
				options: {
					activate: true,
				},
			},
		],
	};

	// Run the blueprint.
	let errors: string[] = [];
	let attempts = 0;
	do {
		// Ensure tmp directory exists.
		fs.rmSync(tmp_dir, { recursive: true, force: true });
		fs.mkdirSync(tmp_dir);
		fs.mkdirSync(`${tmp_dir}/home`);
		fs.mkdirSync(`${tmp_dir}/tmp`);
		fs.mkdirSync(`${tmp_dir}/wordpress`);

		let should_retry = false;
		errors = [];
		attempts += 1;

		try {
			await runCLI({
				command: 'run-blueprint',
				blueprint,
				debug,
				verbosity: 'quiet',
				internalCookieStore: true,
				'mount-before-install': [
					{
						hostPath: `${tmp_dir}/home`,
						vfsPath: '/home',
					},
					{
						hostPath: `${tmp_dir}/tmp`,
						vfsPath: '/tmp',
					},
					{
						hostPath: `${tmp_dir}/wordpress`,
						vfsPath: '/wordpress',
					},
				],
			});
		} catch (error) {
			errors.push(error.message.trim());
			should_retry = true;
		}

		// Read the error log file.
		const error_log = fs.existsSync(
			`${tmp_dir}/wordpress/wp-content/debug.log`
		)
			? fs.readFileSync(
					`${tmp_dir}/wordpress/wp-content/debug.log`,
					'utf8'
			  )
			: '';

		for (const error of error_log.split('\n')) {
			// Exclude PHP notices.
			if (error.includes('] PHP Notice: ')) {
				continue;
			}

			// Error on the Smash Balloon Social Photo Feed plugin side.
			// This error appears also when used without Playground or SQLite.
			if (error.includes('no such table: wp_sbi_feeds')) {
				continue;
			}
			errors.push(error.trim());
		}

		if (
			errors
				.join('\n')
				.includes(
					'Could not download "https://downloads.wordpress.org/plugin/'
				)
		) {
			should_retry = true;
		}

		if (should_retry) {
			await new Promise((resolve) => setTimeout(resolve, 3000));
			continue;
		}

		break;
	} while (attempts <= max_attempts);

	const error = errors.length > 0 ? errors.join('\n') : undefined;
	results.push({ plugin, error });
	console.log(error ? '[ERROR]' : '[OK]');

	// Sleep for 3 seconds to avoid wordpress.org rate limiting.
	await new Promise((resolve) => setTimeout(resolve, 3000));
}

// Print the results.
const errors = results.filter((result) => result.error);
const total_count = results.length;
const error_count = errors.length;
const success_count = total_count - error_count;

const success_rate = Math.round((success_count / total_count) * 100);
const error_rate = Math.round((error_count / total_count) * 100);

const formatted_success_count = success_count
	.toString()
	.padStart(total_count.toString().length, ' ');
const formatted_error_count = error_count
	.toString()
	.padStart(total_count.toString().length, ' ');

const summary = [
	`\n${'='.repeat(100)}\n`,
	`SUCCESS RATE: ${formatted_success_count}/${total_count} (${success_rate}%)`,
	`ERROR RATE:   ${formatted_error_count}/${total_count} (${error_rate}%)`,
	`\n${'='.repeat(100)}\n`,
].join('\n');

console.log(summary);

for (const [i, error] of errors.entries()) {
	console.log(`ERROR when activating '${error.plugin.slug}':\n`);
	console.log(`${error.error.trim()}\n`);

	if (i < errors.length - 1) {
		console.log('-'.repeat(100));
	}
}

if (error_count > 0) {
	console.log(summary);
}

process.exit(0);
