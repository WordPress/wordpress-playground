import type { WarningSeverity } from '../types';

/**
 * Sensitive paths that warrant danger severity when modified.
 */
export const SENSITIVE_PATHS = [
	'/wp-config.php',
	'/wp-includes/',
	'/wp-admin/',
	'/.htaccess',
	'/wp-content/db.php',
	'/wp-content/object-cache.php',
	'/wp-content/advanced-cache.php',
	'/wp-content/sunrise.php',
	'/wp-content/mu-plugins/',
];

/**
 * Paths where writing PHP files is particularly suspicious.
 */
export const EXECUTABLE_SENSITIVE_PATHS = [
	'/wp-content/uploads/', // PHP in uploads is a classic backdoor location
	'/wp-content/cache/',
	'/wp-content/upgrade/',
];

/**
 * Check if a path is sensitive and warrants danger severity.
 */
export function isSensitivePath(path: string): boolean {
	const normalizedPath = normalizePath(path);
	return SENSITIVE_PATHS.some(
		(sensitive) =>
			normalizedPath === sensitive || normalizedPath.startsWith(sensitive)
	);
}

/**
 * Check if path is in a location where executable files are suspicious.
 */
export function isExecutableSensitivePath(path: string): boolean {
	const normalizedPath = normalizePath(path);
	return EXECUTABLE_SENSITIVE_PATHS.some((sensitive) =>
		normalizedPath.startsWith(sensitive)
	);
}

/**
 * Check if a file is a PHP file based on extension.
 */
export function isPhpFile(path: string): boolean {
	const normalizedPath = path.toLowerCase();
	return (
		normalizedPath.endsWith('.php') ||
		normalizedPath.endsWith('.phtml') ||
		normalizedPath.endsWith('.php5') ||
		normalizedPath.endsWith('.php7') ||
		normalizedPath.endsWith('.phar')
	);
}

/**
 * Normalize a path for comparison.
 */
export function normalizePath(path: string): string {
	let normalized = path;
	if (!normalized.startsWith('/')) {
		normalized = '/' + normalized;
	}
	// Remove /wordpress prefix if present (common in Playground)
	if (normalized.startsWith('/wordpress/')) {
		normalized = normalized.substring('/wordpress'.length);
	}
	return normalized;
}

export interface FileContentPattern {
	name: string;
	pattern: RegExp;
	severity: WarningSeverity;
	description: string;
}

/**
 * Patterns to detect in file content being written.
 */
export const FILE_CONTENT_PATTERNS: FileContentPattern[] = [
	// PHP code injection
	{
		name: 'php-tag',
		pattern: /<\?php|\<\?=/i,
		severity: 'danger',
		description: 'Contains PHP code',
	},
	{
		name: 'php-short-tag',
		pattern: /<\?\s+/,
		severity: 'warning',
		description: 'May contain PHP short tags',
	},

	// Backdoor signatures
	{
		name: 'eval-base64',
		pattern: /eval\s*\(\s*base64_decode/i,
		severity: 'danger',
		description: 'Contains obfuscated code execution (eval + base64)',
	},
	{
		name: 'webshell-signature',
		pattern:
			/\$_(GET|POST|REQUEST|COOKIE)\s*\[\s*['"][^'"]+['"]\s*\]\s*\(/i,
		severity: 'danger',
		description: 'Contains webshell-like code pattern',
	},
	{
		name: 'shell-exec-pattern',
		pattern:
			/(shell_exec|system|passthru|exec)\s*\(\s*\$_(GET|POST|REQUEST)/i,
		severity: 'danger',
		description: 'Contains remote command execution pattern',
	},

	// Suspicious patterns
	{
		name: 'hidden-admin',
		pattern: /wp_insert_user|wp_create_user.*administrator/i,
		severity: 'danger',
		description: 'Creates WordPress admin user',
	},
	{
		name: 'disable-security',
		pattern: /remove_filter\s*\(\s*['"]authenticate/i,
		severity: 'danger',
		description: 'Disables authentication filters',
	},
];

/**
 * Analyze file content for suspicious patterns.
 */
export function analyzeFileContent(content: string): Array<{
	pattern: FileContentPattern;
	match: string;
}> {
	const findings: Array<{ pattern: FileContentPattern; match: string }> = [];

	for (const pattern of FILE_CONTENT_PATTERNS) {
		const match = content.match(pattern.pattern);
		if (match) {
			findings.push({
				pattern,
				match: match[0],
			});
		}
	}

	return findings;
}

export interface FileWriteAnalysis {
	severity: WarningSeverity;
	title: string;
	reasons: string[];
}

/**
 * Analyze a file write operation for security concerns.
 */
export function analyzeFileWrite(
	path: string,
	content?: string
): FileWriteAnalysis {
	const normalizedPath = normalizePath(path);
	const reasons: string[] = [];
	let severity: WarningSeverity = 'info';
	let title = 'Write file';

	// Check path sensitivity
	if (isSensitivePath(normalizedPath)) {
		severity = 'danger';
		title = 'Write to sensitive location';
		reasons.push(`Writing to sensitive path: ${normalizedPath}`);
	}

	// Check for PHP files
	if (isPhpFile(normalizedPath)) {
		if (isExecutableSensitivePath(normalizedPath)) {
			severity = 'danger';
			title = 'Write PHP file to suspicious location';
			reasons.push(
				`Writing PHP file to ${normalizedPath} (uploads/cache dirs should not contain PHP)`
			);
		} else if (severity !== 'danger') {
			severity = 'warning';
			title = 'Write PHP file';
			reasons.push('Writing executable PHP file');
		}
	}

	// Analyze content if available
	if (content) {
		const contentFindings = analyzeFileContent(content);

		for (const finding of contentFindings) {
			if (finding.pattern.severity === 'danger') {
				severity = 'danger';
				title = 'Write file with dangerous content';
			} else if (
				finding.pattern.severity === 'warning' &&
				severity !== 'danger'
			) {
				severity = 'warning';
			}
			reasons.push(finding.pattern.description);
		}
	}

	// Default reason if none found
	if (reasons.length === 0) {
		reasons.push(`Writes to: ${normalizedPath}`);
	}

	return { severity, title, reasons };
}
