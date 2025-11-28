export type SupportedLanguage =
	| 'php'
	| 'sql'
	| 'shell'
	| 'html'
	| 'markdown'
	| 'text';

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
	// wp-cli step - command field contains shell commands
	{ pathPattern: /\.steps\[\d+\]\.command$/, language: 'shell' },
];

/**
 * Detect the appropriate language for a string at a given JSON path.
 * Also considers the step type from the discriminator if available.
 *
 * @param jsonPath - The JSON path as an array of path segments (e.g., ['steps', '0', 'code'])
 * @param stepType - Optional step type discriminator value (e.g., 'runPHP')
 * @param content - Optional string content for heuristic detection
 * @returns The detected language or 'text' if no specific language is detected
 */
export function detectLanguage(
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
		const stepTypeLower = stepType.toLowerCase();

		// PHP-related steps (runPHP, runPHPWithOptions, etc.)
		if (stepTypeLower.includes('php')) {
			return 'php';
		}
		// SQL-related steps
		if (stepTypeLower.includes('sql')) {
			return 'sql';
		}
		// WP-CLI or shell-related steps
		if (
			stepTypeLower.includes('wp-cli') ||
			stepTypeLower.includes('shell')
		) {
			return 'shell';
		}
	}

	// Finally, try content-based heuristics
	if (content) {
		const detected = detectLanguageFromContent(content);
		if (detected !== 'text') {
			return detected;
		}
	}

	return 'text';
}

/**
 * Detect language from string content using simple heuristics
 */
export function detectLanguageFromContent(content: string): SupportedLanguage {
	const trimmed = content.trim();

	// PHP detection
	if (
		trimmed.startsWith('<?php') ||
		trimmed.startsWith('<?') ||
		trimmed.startsWith('#!/usr/bin/env php') ||
		// Common PHP patterns
		/\$[a-zA-Z_]\w*\s*=/.test(trimmed) || // Variable assignment
		/function\s+\w+\s*\(/.test(trimmed) || // Function declaration
		/\b(echo|print|require|include|use|namespace|class)\b/.test(trimmed)
	) {
		return 'php';
	}

	// SQL detection
	if (
		/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|REPLACE)\b/i.test(
			trimmed
		) ||
		/^\s*--.*\n?\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)/im.test(trimmed) || // SQL with comment
		/\b(FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING)\b/i.test(trimmed)
	) {
		return 'sql';
	}

	// Shell detection
	if (
		trimmed.startsWith('#!/bin/') ||
		trimmed.startsWith('#!/usr/bin/env') ||
		/^(wp|npm|yarn|git|curl|wget|chmod|chown|mkdir|rm|cp|mv|ls|cd|echo|export)\s/m.test(
			trimmed
		) ||
		/\|\s*(grep|awk|sed|xargs|sort|uniq)/.test(trimmed)
	) {
		return 'shell';
	}

	// HTML detection
	if (
		/^\s*<!DOCTYPE\s+html/i.test(trimmed) ||
		/^\s*<html[\s>]/i.test(trimmed) ||
		/<(div|span|p|a|img|table|form|input|button|head|body|script|style|link|meta)[\s>\/]/i.test(
			trimmed
		)
	) {
		return 'html';
	}

	// Markdown detection (simple patterns)
	if (
		/^#{1,6}\s+\S/.test(trimmed) || // Headers: # Header
		/^\s*[-*+]\s+\S/.test(trimmed) || // Unordered lists
		/^\s*\d+\.\s+\S/.test(trimmed) || // Ordered lists
		/\[.+\]\(.+\)/.test(trimmed) || // Links: [text](url)
		/^>\s+\S/.test(trimmed) || // Blockquotes
		/```[\s\S]*```/.test(trimmed) || // Code blocks
		/\*\*.+\*\*/.test(trimmed) || // Bold
		/^\s*\|.+\|/.test(trimmed) // Tables
	) {
		return 'markdown';
	}

	return 'text';
}

/**
 * Get a human-readable label for a language
 */
export function getLanguageLabel(language: SupportedLanguage): string {
	switch (language) {
		case 'php':
			return 'PHP';
		case 'sql':
			return 'SQL';
		case 'shell':
			return 'Shell';
		case 'html':
			return 'HTML';
		case 'markdown':
			return 'Markdown';
		case 'text':
			return 'Plain Text';
	}
}

/**
 * Get all available languages for the dropdown
 */
export function getAvailableLanguages(): {
	value: SupportedLanguage;
	label: string;
}[] {
	return [
		{ value: 'php', label: 'PHP' },
		{ value: 'sql', label: 'SQL' },
		{ value: 'shell', label: 'Shell' },
		{ value: 'html', label: 'HTML' },
		{ value: 'markdown', label: 'Markdown' },
		{ value: 'text', label: 'Plain Text' },
	];
}
