/**
 * Detect language from string content using simple heuristics
 */
export type SupportedLanguage =
	| 'html'
	| 'javascript'
	| 'css'
	| 'php'
	| 'sql'
	| 'markdown'
	| 'plaintext';

interface LanguageRule {
	pathPattern: RegExp;
	language: SupportedLanguage;
}

/**
 * Rules for detecting language based on JSON path.
 * Each rule has a regex pattern that matches against the JSON path
 * and the language to use when matched.
 */
const languageRules: LanguageRule[] = [
	// runPHP step - code field contains PHP
	{ pathPattern: /\.steps\[\d+\]\.code$/, language: 'php' },
	// runSQL step - sql field contains SQL
	{ pathPattern: /\.steps\[\d+\]\.sql$/, language: 'sql' },
];

/**
 * Infers the appropriate syntax highlighting language for a string
 * living at a given JSON path inside of a Blueprint. If the path is
 * not informative, falls back to content-based heuristics.
 *
 * @param jsonPath - The JSON path as an array of path segments (e.g., ['steps', '0', 'code'])
 * @param stepType - Optional step type discriminator value (e.g., 'runPHP')
 * @param content - Optional string content for content-based heuristics
 * @returns The detected language or 'plaintext' if no specific language is detected
 */
export function inferLanguageFromBlueprint(
	jsonPath: string[],
	stepType?: string,
	content?: string
): SupportedLanguage {
	// Build a dot-notation path for matching
	const pathString =
		'.' +
		jsonPath
			.map((segment) => {
				// Check if this segment looks like an array index
				if (/^\d+$/.test(segment)) {
					return `[${segment}]`;
				}
				return segment;
			})
			.join('.')
			.replace(/\.\[/g, '[');

	// First, try path-based detection
	for (const rule of languageRules) {
		if (rule.pathPattern.test(pathString)) {
			return rule.language;
		}
	}

	// Then, try step-type-based detection
	// If we know the step type, use it to infer the language
	if (stepType) {
		if (stepType === 'runPHP' || stepType === 'runPHPWithOptions') {
			if (jsonPath[jsonPath.length - 1] === 'code') {
				return 'php';
			}
		}
		if (stepType === 'runSQL') {
			if (jsonPath[jsonPath.length - 1] === 'sql') {
				return 'sql';
			}
		}
	}

	// Finally, try content-based heuristics
	return inferLanguageFromContent(content || '');
}

/**
 * Heuristically detects the most likely language of a text snippet
 * (HTML, JavaScript, CSS, PHP, SQL, or Markdown) and returns "plaintext"
 * when no language has enough signal.
 */
export function inferLanguageFromContent(input: string): SupportedLanguage {
	const text = input.trim();
	if (!text) return 'plaintext';

	const lower = text.toLowerCase();

	const scores: Record<Exclude<SupportedLanguage, 'plaintext'>, number> = {
		html: 0,
		javascript: 0,
		css: 0,
		php: 0,
		sql: 0,
		markdown: 0,
	};

	const bump = (lang: keyof typeof scores, value = 1) => {
		scores[lang] += value;
	};

	// --- Strong, almost definitive signals ---

	// PHP
	if (text.includes('<?php') || text.includes('<?= ')) {
		bump('php', 10);
	}
	if (/\$\w+/.test(text)) bump('php', 2);
	if (/\bnamespace\b|\buse\s+[\w\\]+;/.test(text)) bump('php', 2);
	if (/\becho\b|\bvar_dump\s*\(/.test(lower)) bump('php', 1);

	// HTML
	if (/<!doctype\s+html>/i.test(text)) bump('html', 10);
	if (/^<html[\s>]/i.test(text)) bump('html', 8);
	if (/<head[\s>]/i.test(text) || /<body[\s>]/i.test(text)) bump('html', 6);
	if (/<[a-z][^>]*>/.test(text)) bump('html', 3);
	if (/<\/[a-z][^>]*>/.test(text)) bump('html', 3);
	if (/\b<!--.*?-->/.test(text)) bump('html', 1);

	// CSS
	if (/\b@media\b|\b@keyframes\b|\b:root\b/.test(lower)) bump('css', 4);
	if (/\.[a-z0-9_-]+\s*\{/.test(lower)) bump('css', 3);
	if (/#[a-z0-9_-]+\s*\{/.test(lower)) bump('css', 3);
	if (/[a-z-]+\s*:\s*[^;{}]+;/.test(lower)) bump('css', 2);
	if (/\bdisplay\s*:\s*(flex|grid|block|inline)/.test(lower)) bump('css', 2);

	// JavaScript
	if (/\b(import|export)\s+[^;]+from\b/.test(text)) bump('javascript', 5);
	if (/\b(async\s+)?function\b/.test(text)) bump('javascript', 3);
	if (/\bconst\b|\blet\b|\bvar\b/.test(text)) bump('javascript', 2);
	if (/=>/.test(text)) bump('javascript', 2);
	if (/\bclass\s+\w+/.test(text)) bump('javascript', 1);
	if (/\bconsole\.\w+\s*\(/.test(text)) bump('javascript', 2);
	if (/\bdocument\.\w+|\bwindow\.\w+/.test(text)) bump('javascript', 2);
	if (/;\s*$/.test(text)) bump('javascript', 1);

	// SQL
	if (/\bselect\b[\s\S]+\bfrom\b/i.test(text)) bump('sql', 6);
	if (/\binsert\s+into\b/i.test(text)) bump('sql', 4);
	if (/\bupdate\b[\s\S]+\bset\b/i.test(text)) bump('sql', 4);
	if (/\bdelete\s+from\b/i.test(text)) bump('sql', 4);
	if (/\bcreate\s+table\b/i.test(text)) bump('sql', 4);
	if (/\binner\s+join\b|\bleft\s+join\b|\bright\s+join\b/i.test(text))
		bump('sql', 3);
	if (/\bwhere\b|\border\s+by\b|\bgroup\s+by\b/i.test(text)) bump('sql', 1);

	// Markdown
	const lines = text.split(/\r?\n/);

	let mdHeadingCount = 0;
	let mdListCount = 0;
	let mdCodeFenceCount = 0;
	let mdLinkCount = 0;
	let mdQuoteCount = 0;

	for (const line of lines) {
		const trimmed = line.trim();

		if (/^#{1,6}\s+\S/.test(trimmed)) mdHeadingCount++;
		if (/^(\*|-|\+)\s+\S/.test(trimmed)) mdListCount++;
		if (/^```/.test(trimmed)) mdCodeFenceCount++;
		if (/^>\s+\S/.test(trimmed)) mdQuoteCount++;
	}

	if (/\[[^\]]+\]\([^)]+\)/.test(text)) mdLinkCount++;

	if (mdHeadingCount > 0) bump('markdown', 2 + mdHeadingCount);
	if (mdListCount > 0) bump('markdown', 1 + mdListCount);
	if (mdCodeFenceCount > 0) bump('markdown', 3 + mdCodeFenceCount);
	if (mdLinkCount > 0) bump('markdown', 3);
	if (mdQuoteCount > 0) bump('markdown', 1 + mdQuoteCount);

	// Markdown vs HTML conflict: if there are many angle brackets, tilt to HTML
	const angleBrackets =
		(text.match(/</g)?.length ?? 0) + (text.match(/>/g)?.length ?? 0);
	if (angleBrackets > 5) bump('html', 3);

	// CSS vs JS conflict: if there are many colons in property-like context, tilt to CSS
	if (/[a-z-]+\s*:\s*[^;{}]+;/.test(lower) && /\{[\s\S]*\}/.test(text)) {
		bump('css', 2);
	}

	// JS vs PHP: if PHP tags present, PHP wins anyway (already given big weight)

	// Final decision
	let bestLang: SupportedLanguage = 'plaintext';
	let bestScore = 0;

	for (const [lang, score] of Object.entries(scores)) {
		if (score > bestScore) {
			bestScore = score;
			bestLang = lang as SupportedLanguage;
		}
	}

	// Require minimal confidence
	if (bestScore < 2) return 'plaintext';

	return bestLang;
}

export const languageLabels: Record<SupportedLanguage, string> = {
	php: 'PHP',
	sql: 'SQL',
	html: 'HTML',
	markdown: 'Markdown',
	javascript: 'JavaScript',
	css: 'CSS',
	plaintext: 'Plain Text',
};
