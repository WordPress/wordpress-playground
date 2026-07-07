import type { Changeset } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';

export interface PRDescription {
	title: string;
	body: string;
}

type ContentType = 'wp-content' | 'theme' | 'plugin' | 'custom-paths';

/**
 * Generates a PR title and description using the OpenAI API based on
 * the files changed in the export.
 *
 * Returns null when no API key is provided or when anything goes wrong –
 * the caller is expected to fall back to its default title and message.
 * This function must never block or break the export flow.
 *
 * @param changeset - The file changes about to be pushed to GitHub.
 * @param apiKey - The user-provided OpenAI API key.
 * @param contentType - What kind of content is being exported.
 */
export async function generatePrDescription(
	changeset: Changeset,
	apiKey: string | undefined,
	contentType: ContentType
): Promise<PRDescription | null> {
	if (!apiKey?.trim()) {
		return null;
	}

	try {
		const summary = summarizeChangeset(changeset, contentType);

		const prompt = `You are a helpful assistant that generates concise GitHub pull request titles and descriptions.

Based on the following changes, generate:
1. A short, descriptive PR title (under 72 characters)
2. A brief PR description (2-3 sentences)

Changes:
${summary}

Respond in JSON format with "title" and "body" fields.`;

		const response = await fetch(
			'https://api.openai.com/v1/chat/completions',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: 'gpt-4o-mini',
					messages: [
						{
							role: 'user',
							content: prompt,
						},
					],
					temperature: 0.7,
					max_tokens: 200,
				}),
			}
		);

		if (!response.ok) {
			logger.warn(
				`OpenAI API error: ${response.status} ${response.statusText}`
			);
			return null;
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string } }>;
		};

		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			logger.warn('Unexpected OpenAI response format');
			return null;
		}

		const parsed = parsePrDescription(content);
		if (!parsed) {
			logger.warn(
				'Could not parse the OpenAI response into a PR description'
			);
		}
		return parsed;
	} catch (error) {
		logger.warn('Error generating the PR description:', error);
		return null;
	}
}

/**
 * Summarizes a changeset into a short, text-only digest for the AI prompt.
 * Only file paths are included – never file contents. This keeps the token
 * count low and avoids sending potentially sensitive data to the API.
 */
function summarizeChangeset(
	changeset: Changeset,
	contentType: ContentType
): string {
	const lines: string[] = [];

	if (contentType === 'theme') {
		lines.push('Updating a WordPress theme.');
	} else if (contentType === 'plugin') {
		lines.push('Updating a WordPress plugin.');
	} else if (contentType === 'wp-content') {
		lines.push('Updating WordPress site content (wp-content directory).');
	} else {
		lines.push('Updating custom paths in a WordPress installation.');
	}

	const sections: Array<[string, Iterable<string>, number]> = [
		['New files', changeset.create.keys(), changeset.create.size],
		['Modified files', changeset.update.keys(), changeset.update.size],
		['Deleted files', changeset.delete.values(), changeset.delete.size],
	];
	const maxPathsPerSection = 10;
	for (const [label, paths, total] of sections) {
		if (total === 0) {
			continue;
		}
		lines.push(
			`\n${label} (${total} total, showing first ${Math.min(
				total,
				maxPathsPerSection
			)}):`
		);
		const shownPaths = Array.from(paths).slice(0, maxPathsPerSection);
		shownPaths.forEach((path) => lines.push(`  - ${path}`));
		if (total > maxPathsPerSection) {
			lines.push(`  ... and ${total - maxPathsPerSection} more`);
		}
	}

	return lines.join('\n');
}

/**
 * Parses the model output into a title and body. Accepts a JSON object
 * with "title" and "body" fields, and falls back to treating the first
 * line as the title and the rest as the body.
 */
function parsePrDescription(content: string): PRDescription | null {
	try {
		const parsed = JSON.parse(content);
		const title = (parsed.title || '').trim();
		const body = (parsed.body || '').trim();
		if (title && body) {
			return { title, body };
		}
	} catch {
		const lines = content.split('\n');
		if (lines.length >= 2) {
			const title = lines[0].replace(/^["']|["']$/g, '').trim();
			const body = lines
				.slice(1)
				.join('\n')
				.replace(/^["']|["']$/g, '')
				.trim();
			if (title && body) {
				return { title, body };
			}
		}
	}
	return null;
}
