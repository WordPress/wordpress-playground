import { Plugin } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Plugin options interface
interface AnalyticsPluginOptions {
	verbose?: boolean;
}

/**
 * Vite plugin to inject Google Analytics into the head tag of HTML files
 *
 * @param options Plugin options
 * @returns {Plugin} A Vite plugin that processes HTML files during build
 */
export function analyticsInjectionPlugin(
	options: AnalyticsPluginOptions = {}
): Plugin {
	// Default options
	const { verbose = false } = options;

	// Shared analytics script template
	const getAnalyticsScript = (id: string) => {
		return `
		<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() { dataLayer.push(arguments); }
			gtag('js', new Date());
			gtag('config', '${id}');
		</script>
`;
	};

	// Helper function for conditional logging
	const log = (msg: string, isError = false) => {
		// Only log if it's an error or verbose mode is enabled
		if (isError || verbose) {
			isError ? console.error(msg) : console.log(msg);
		}
	};

	return {
		name: 'vite-plugin-analytics-injection',
		apply: 'build', // Only apply during build, not dev

		writeBundle(options, bundle) {
			const googleAnalyticsId = process.env.VITE_GOOGLE_ANALYTICS_ID;

			if (!googleAnalyticsId) {
				log(
					'Google Analytics disabled - no tracking will be added to HTML files.'
				);
				return;
			}

			log('Processing HTML files for Google Analytics injection...');

			// Files to process - include all HTML files that need analytics
			const htmlFiles = [
				'index.html',
				'wordpress.html',
				'gutenberg.html',
			];
			const outputDir = options.dir || '';

			let processedCount = 0;
			let skippedCount = 0;
			let notFoundCount = 0;

			htmlFiles.forEach((htmlFile) => {
				const outputPath = join(outputDir, htmlFile);

				if (existsSync(outputPath)) {
					log(`Processing ${htmlFile} for analytics...`);

					try {
						// Read file
						const content = readFileSync(outputPath, 'utf8');

						// Check if the file already has analytics (to avoid duplicate injection)
						if (
							content.includes(
								`gtag('config', '${googleAnalyticsId}')`
							)
						) {
							log(
								`Analytics already present in ${htmlFile}, skipping.`
							);
							skippedCount++;
							return;
						}

						// Find the closing head tag
						const headCloseIndex = content.indexOf('</head>');
						if (headCloseIndex === -1) {
							log(
								`Could not find </head> tag in ${htmlFile}, skipping.`,
								true
							);
							skippedCount++;
							return;
						}

						// Insert the analytics script right before the closing head tag
						const analyticsScript =
							getAnalyticsScript(googleAnalyticsId);
						const updatedContent =
							content.substring(0, headCloseIndex) +
							analyticsScript +
							content.substring(headCloseIndex);

						// Write back
						writeFileSync(outputPath, updatedContent, 'utf8');
						log(`Successfully injected analytics into ${htmlFile}`);
						processedCount++;
					} catch (error) {
						log(`Error processing ${htmlFile}: ${error}`, true);
					}
				} else {
					log(`File not found in build directory: ${outputPath}`);
					notFoundCount++;
				}
			});

			// Always show summary even in non-verbose mode
			if (processedCount > 0) {
				log(
					`Analytics injection: ${processedCount} files processed, ${skippedCount} skipped, ${notFoundCount} not found.`
				);
			}
		},
	};
}
