/**
 * PHP code analyzer using the simple tokenizer.
 *
 * Analyzes tokenized PHP code to detect:
 * - Dangerous function calls
 * - Variable function calls (dynamic execution)
 * - Superglobal access (user input)
 * - Backtick shell execution
 * - Suspicious string patterns
 */

import { tokenize, filterSignificantTokens, type Token } from './tokenizer';
import type { WarningSeverity } from '../types';

export interface PhpFinding {
	type:
		| 'function_call'
		| 'variable_function'
		| 'superglobal'
		| 'backtick_exec'
		| 'suspicious_string';
	severity: WarningSeverity;
	name: string;
	description: string;
	line: number;
}

/**
 * Dangerous functions categorized by severity.
 */
const DANGEROUS_FUNCTIONS: Record<
	string,
	{ severity: WarningSeverity; description: string }
> = {
	// Danger: Code/command execution
	eval: { severity: 'danger', description: 'Executes arbitrary PHP code' },
	assert: {
		severity: 'danger',
		description: 'Can execute code when passed a string',
	},
	create_function: {
		severity: 'danger',
		description: 'Creates function from string (deprecated)',
	},
	exec: { severity: 'danger', description: 'Executes shell command' },
	shell_exec: { severity: 'danger', description: 'Executes shell command' },
	system: { severity: 'danger', description: 'Executes shell command' },
	passthru: { severity: 'danger', description: 'Executes shell command' },
	popen: { severity: 'danger', description: 'Opens process' },
	proc_open: {
		severity: 'danger',
		description: 'Opens process with full control',
	},
	pcntl_exec: { severity: 'danger', description: 'Replaces current process' },

	// Danger: Network (data exfiltration)
	curl_exec: { severity: 'danger', description: 'Executes cURL request' },
	fsockopen: { severity: 'danger', description: 'Opens network socket' },
	pfsockopen: { severity: 'danger', description: 'Opens persistent socket' },
	stream_socket_client: {
		severity: 'danger',
		description: 'Opens socket connection',
	},

	// Warning: Network (could be legitimate)
	file_get_contents: {
		severity: 'warning',
		description: 'Reads file or URL',
	},
	curl_init: { severity: 'warning', description: 'Initializes cURL session' },
	wp_remote_get: {
		severity: 'warning',
		description: 'Makes HTTP GET request',
	},
	wp_remote_post: {
		severity: 'warning',
		description: 'Makes HTTP POST request',
	},
	wp_remote_request: {
		severity: 'warning',
		description: 'Makes HTTP request',
	},

	// Warning: File writes
	file_put_contents: { severity: 'warning', description: 'Writes to file' },
	fwrite: { severity: 'warning', description: 'Writes to file' },
	fputs: { severity: 'warning', description: 'Writes to file' },

	// Warning: Dynamic execution
	call_user_func: {
		severity: 'warning',
		description: 'Calls function dynamically',
	},
	call_user_func_array: {
		severity: 'warning',
		description: 'Calls function dynamically',
	},
	preg_replace_callback: {
		severity: 'warning',
		description: 'Executes callback on matches',
	},

	// Warning: Encoding (often used for obfuscation)
	base64_decode: {
		severity: 'warning',
		description: 'Decodes base64 (often hides malicious code)',
	},
	gzinflate: { severity: 'warning', description: 'Decompresses data' },
	gzuncompress: { severity: 'warning', description: 'Decompresses data' },
	gzdecode: { severity: 'warning', description: 'Decodes gzip data' },
	str_rot13: {
		severity: 'warning',
		description: 'ROT13 encoding (often obfuscation)',
	},

	// Warning: WordPress user management
	wp_insert_user: {
		severity: 'warning',
		description: 'Creates WordPress user',
	},
	wp_create_user: {
		severity: 'warning',
		description: 'Creates WordPress user',
	},
	wp_set_password: {
		severity: 'warning',
		description: 'Changes user password',
	},

	// Warning: Database
	mysqli_query: {
		severity: 'warning',
		description: 'Executes database query',
	},

	// Info: Information disclosure
	phpinfo: { severity: 'info', description: 'Displays PHP configuration' },
	getenv: { severity: 'info', description: 'Gets environment variable' },
	get_defined_vars: {
		severity: 'info',
		description: 'Gets all defined variables',
	},

	// Info: WordPress options
	update_option: {
		severity: 'info',
		description: 'Updates WordPress option',
	},
	add_option: { severity: 'info', description: 'Adds WordPress option' },
	delete_option: {
		severity: 'info',
		description: 'Deletes WordPress option',
	},
};

/**
 * Superglobals that indicate user input.
 */
const SUPERGLOBALS = [
	'$_GET',
	'$_POST',
	'$_REQUEST',
	'$_COOKIE',
	'$_FILES',
	'$_SERVER',
];

/**
 * Analyze PHP code for security concerns.
 */
export function analyzePhpCode(code: string): PhpFinding[] {
	const tokens = tokenize(code);
	const significant = filterSignificantTokens(tokens);
	const findings: PhpFinding[] = [];

	for (let i = 0; i < significant.length; i++) {
		const token = significant[i];
		const next = significant[i + 1];

		// Check for function calls: identifier followed by (
		if (token.type === 'T_STRING' && next?.type === 'T_OPEN_PAREN') {
			const funcName = token.value.toLowerCase();
			const funcInfo = DANGEROUS_FUNCTIONS[funcName];

			if (funcInfo) {
				findings.push({
					type: 'function_call',
					severity: funcInfo.severity,
					name: token.value,
					description: funcInfo.description,
					line: token.line,
				});
			}
		}

		// Check for variable function calls: $var(...) or $var[...](...)
		if (token.type === 'T_VARIABLE') {
			const callIndex = findFunctionCallAfterVariable(significant, i);
			if (callIndex !== -1) {
				findings.push({
					type: 'variable_function',
					severity: 'danger',
					name: token.value,
					description:
						'Calls function via variable (potential code execution)',
					line: token.line,
				});
			}
		}

		// Check for superglobal access
		if (token.type === 'T_VARIABLE' && SUPERGLOBALS.includes(token.value)) {
			findings.push({
				type: 'superglobal',
				severity: 'warning',
				name: token.value,
				description: `Accesses user input via ${token.value}`,
				line: token.line,
			});
		}

		// Check for backtick shell execution
		if (token.type === 'T_BACKTICK_STRING') {
			findings.push({
				type: 'backtick_exec',
				severity: 'danger',
				name: 'backtick operator',
				description: 'Executes shell command via backticks',
				line: token.line,
			});
		}

		// Check string literals for suspicious patterns
		if (token.type === 'T_CONSTANT_STRING') {
			const stringFindings = analyzeString(token.value, token.line);
			findings.push(...stringFindings);
		}
	}

	return deduplicateFindings(findings);
}

/**
 * Look ahead from a variable to see if it's used as a function call.
 * Handles patterns like: $var(), $var[0](), $obj->$method()
 */
function findFunctionCallAfterVariable(
	tokens: Token[],
	startIndex: number
): number {
	let i = startIndex + 1;
	let bracketDepth = 0;

	while (i < tokens.length) {
		const token = tokens[i];

		if (token.type === 'T_OPEN_BRACKET') {
			bracketDepth++;
		} else if (token.type === 'T_CLOSE_BRACKET') {
			bracketDepth--;
		} else if (token.type === 'T_OPEN_PAREN' && bracketDepth === 0) {
			return i;
		} else if (bracketDepth === 0) {
			// Hit something else, not a function call
			break;
		}

		i++;
	}

	return -1;
}

/**
 * Analyze a string literal for suspicious content.
 */
function analyzeString(value: string, line: number): PhpFinding[] {
	const findings: PhpFinding[] = [];

	// Remove quotes
	const content = value.slice(1, -1);

	// Check for URLs to PHP files
	if (/https?:\/\/[^\s'"]+\.php/i.test(content)) {
		findings.push({
			type: 'suspicious_string',
			severity: 'warning',
			name: 'URL to PHP file',
			description: 'Contains URL pointing to PHP file',
			line,
		});
	}

	// Check for base64 that decodes to PHP
	if (/^[A-Za-z0-9+/=]{50,}$/.test(content)) {
		try {
			const decoded = atob(content);
			if (decoded.includes('<?php') || decoded.includes('eval')) {
				findings.push({
					type: 'suspicious_string',
					severity: 'danger',
					name: 'Encoded PHP code',
					description: 'Contains base64-encoded PHP code',
					line,
				});
			}
		} catch {
			// Not valid base64, ignore
		}
	}

	return findings;
}

/**
 * Remove duplicate findings (same type, name, and line).
 */
function deduplicateFindings(findings: PhpFinding[]): PhpFinding[] {
	const seen = new Set<string>();
	return findings.filter((f) => {
		const key = `${f.type}:${f.name}:${f.line}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

/**
 * Group findings by severity.
 */
export function groupFindingsBySeverity(
	findings: PhpFinding[]
): Record<WarningSeverity, PhpFinding[]> {
	return {
		danger: findings.filter((f) => f.severity === 'danger'),
		warning: findings.filter((f) => f.severity === 'warning'),
		info: findings.filter((f) => f.severity === 'info'),
	};
}
