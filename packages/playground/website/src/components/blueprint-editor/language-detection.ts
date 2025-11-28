export type SupportedLanguage = 'php' | 'sql' | 'shell' | 'text';

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
 * @returns The detected language or 'text' if no specific language is detected
 */
export function detectLanguage(
	jsonPath: string[],
	stepType?: string
): SupportedLanguage {
	// Build a dot-notation path for matching
	const pathString =
		'.' +
		jsonPath
			.map((segment, index) => {
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

	// Then, try step-type-based detection for code fields
	if (stepType) {
		const lastSegment = jsonPath[jsonPath.length - 1];

		if (stepType === 'runPHP' && lastSegment === 'code') {
			return 'php';
		}
		if (
			stepType === 'runSQL' &&
			(lastSegment === 'sql' || lastSegment === 'source')
		) {
			return 'sql';
		}
		if (stepType === 'wp-cli' && lastSegment === 'command') {
			return 'shell';
		}
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
		{ value: 'text', label: 'Plain Text' },
	];
}
