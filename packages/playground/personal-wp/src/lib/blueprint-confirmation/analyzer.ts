import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import { normalizePath } from '@php-wasm/util';
import type {
	BlueprintAnalysisResult,
	BlueprintWarning,
	BlueprintWarningSeverity,
} from './types';

export function analyzeBlueprint(
	blueprint: BlueprintV1Declaration
): BlueprintAnalysisResult {
	const warnings = (blueprint.steps || []).flatMap((step, index) =>
		analyzeStep(step, index)
	);

	return {
		warnings: sortWarnings(warnings),
	};
}

function analyzeStep(step: unknown, stepIndex: number): BlueprintWarning[] {
	if (!step || typeof step !== 'object') {
		return [];
	}

	const stepObj = step as Record<string, unknown>;
	const stepName = stepObj.step;

	switch (stepName) {
		case 'installPlugin':
			return analyzeInstallAsset(
				'plugin',
				stepObj.pluginData || stepObj.pluginZipFile,
				stepIndex
			);
		case 'installTheme':
			return analyzeInstallAsset(
				'theme',
				stepObj.themeData || stepObj.themeZipFile,
				stepIndex
			);
		case 'runPHP':
		case 'runPHPWithOptions':
			return [analyzeRunPhpStep(stepObj, stepIndex)];
		case 'wp-cli':
			return [analyzeWpCliStep(stepObj, stepIndex)];
		case 'request':
			return [analyzeRequestStep(stepObj, stepIndex)];
		case 'writeFile':
			return analyzeWritePath(stepObj.path, stepIndex);
		case 'writeFiles':
			return analyzeWriteFilesStep(stepObj, stepIndex);
		case 'rm':
			return [analyzeRemovePath(stepObj.path, 'Delete file', stepIndex)];
		case 'rmdir':
			return [
				analyzeRemovePath(stepObj.path, 'Delete directory', stepIndex),
			];
		case 'cp':
		case 'mv':
			return analyzeMoveOrCopyStep(stepObj, stepName, stepIndex);
		case 'unzip':
			return analyzeArchiveStep(stepObj, stepIndex);
		default:
			return [];
	}
}

function analyzeInstallAsset(
	assetType: 'plugin' | 'theme',
	resource: unknown,
	stepIndex: number
): BlueprintWarning[] {
	if (!resource || typeof resource !== 'object') {
		return [];
	}

	const resourceObj = resource as Record<string, unknown>;
	const resourceType = resourceObj.resource;
	const titleAssetType = titleCase(assetType);

	if (assetType === 'plugin' && resourceType === 'wordpress.org/plugins') {
		const slug =
			typeof resourceObj.slug === 'string' ? resourceObj.slug : '';
		return [
			{
				severity: 'info',
				title: 'Installs plugin from WordPress.org',
				description: slug
					? `${slug} from the WordPress.org plugin directory.`
					: 'Plugin comes from the WordPress.org plugin directory.',
				stepIndex,
			},
		];
	}

	if (resourceType === 'url' && typeof resourceObj.url === 'string') {
		return [
			{
				severity: 'warning',
				title: `Installs ${assetType} from an external source`,
				description: previewUrl(resourceObj.url),
				stepIndex,
			},
		];
	}

	if (typeof resourceType === 'string' && resourceType.startsWith('git:')) {
		return [
			{
				severity: 'warning',
				title: `Installs ${assetType} from a Git repository`,
				description:
					typeof resourceObj.url === 'string'
						? previewUrl(resourceObj.url)
						: `${titleAssetType} files come from a Git source.`,
				stepIndex,
			},
		];
	}

	if (resourceType === 'literal' || resourceType === 'vfs') {
		return [
			{
				severity: 'warning',
				title: `Installs embedded ${assetType} files`,
				description: `${titleAssetType} files are bundled directly with this app request.`,
				stepIndex,
			},
		];
	}

	return [];
}

function analyzeRunPhpStep(
	step: Record<string, unknown>,
	stepIndex: number
): BlueprintWarning {
	const code = typeof step.code === 'string' ? step.code : '';
	const dangerousPattern =
		/\b(eval|exec|shell_exec|system|passthru|proc_open|popen|curl_exec|fsockopen)\s*\(/i;

	if (dangerousPattern.test(code)) {
		return {
			severity: 'danger',
			title: 'Runs PHP code with risky functions',
			description:
				'The code can execute commands, run dynamic PHP, or contact external servers.',
			stepIndex,
		};
	}

	return {
		severity: 'warning',
		title: 'Runs PHP code',
		description: code
			? truncate(cleanCodePreview(code), 120)
			: 'The code was not available for preview.',
		stepIndex,
	};
}

function analyzeWpCliStep(
	step: Record<string, unknown>,
	stepIndex: number
): BlueprintWarning {
	const command = step.command;
	const commandString = Array.isArray(command)
		? command.join(' ')
		: typeof command === 'string'
			? command
			: '';

	return {
		severity: 'warning',
		title: 'Runs a WP-CLI command',
		description: commandString
			? `wp ${truncate(commandString, 120)}`
			: 'Runs a WordPress command line operation.',
		stepIndex,
	};
}

function analyzeRequestStep(
	step: Record<string, unknown>,
	stepIndex: number
): BlueprintWarning {
	const request =
		step.request && typeof step.request === 'object'
			? (step.request as Record<string, unknown>)
			: {};
	const method =
		typeof request.method === 'string'
			? request.method
			: typeof step.method === 'string'
				? step.method
				: 'GET';
	const url =
		typeof request.url === 'string'
			? request.url
			: typeof step.url === 'string'
				? step.url
				: '';

	return {
		severity: 'warning',
		title: 'Makes an HTTP request',
		description: url
			? `${method.toUpperCase()} ${previewUrl(url)}`
			: `Makes an HTTP ${method.toUpperCase()} request.`,
		stepIndex,
	};
}

function analyzeWritePath(
	path: unknown,
	stepIndex: number
): BlueprintWarning[] {
	if (typeof path !== 'string') {
		return [];
	}

	const normalizedPath = normalizeWordPressPath(path);
	const sensitive = isSensitivePath(normalizedPath);
	const phpFile = isPhpFile(normalizedPath);
	const executableLocation = isExecutableSensitivePath(normalizedPath);

	if (sensitive) {
		return [
			{
				severity: 'danger',
				title: 'Writes to a sensitive WordPress file',
				description: normalizedPath,
				stepIndex,
			},
		];
	}

	if (phpFile && executableLocation) {
		return [
			{
				severity: 'danger',
				title: 'Writes PHP to a suspicious location',
				description: normalizedPath,
				stepIndex,
			},
		];
	}

	if (phpFile) {
		return [
			{
				severity: 'warning',
				title: 'Writes PHP code',
				description: normalizedPath,
				stepIndex,
			},
		];
	}

	return [];
}

function analyzeWriteFilesStep(
	step: Record<string, unknown>,
	stepIndex: number
): BlueprintWarning[] {
	const files = step.files;
	if (!files || typeof files !== 'object' || Array.isArray(files)) {
		return [];
	}

	return Object.keys(files).flatMap((path) =>
		analyzeWritePath(path, stepIndex)
	);
}

function analyzeRemovePath(
	path: unknown,
	baseTitle: string,
	stepIndex: number
): BlueprintWarning {
	const normalizedPath =
		typeof path === 'string'
			? normalizeWordPressPath(path)
			: 'unknown path';
	const sensitive = isSensitivePath(normalizedPath);

	return {
		severity: sensitive ? 'danger' : 'warning',
		title: sensitive ? `${baseTitle} from a sensitive location` : baseTitle,
		description: normalizedPath,
		stepIndex,
	};
}

function analyzeMoveOrCopyStep(
	step: Record<string, unknown>,
	stepName: 'cp' | 'mv',
	stepIndex: number
): BlueprintWarning[] {
	const fromPath =
		typeof step.fromPath === 'string'
			? normalizeWordPressPath(step.fromPath)
			: 'unknown path';
	const toPath =
		typeof step.toPath === 'string'
			? normalizeWordPressPath(step.toPath)
			: 'unknown path';
	const touchesSensitivePath =
		isSensitivePath(fromPath) || isSensitivePath(toPath);
	const writesSuspiciousPhp =
		isPhpFile(toPath) && isExecutableSensitivePath(toPath);

	if (!touchesSensitivePath && !writesSuspiciousPhp) {
		return [];
	}

	return [
		{
			severity:
				touchesSensitivePath || writesSuspiciousPhp
					? 'danger'
					: 'warning',
			title:
				stepName === 'cp'
					? 'Copies files to a sensitive location'
					: 'Moves files to a sensitive location',
			description: `${fromPath} -> ${toPath}`,
			stepIndex,
		},
	];
}

function analyzeArchiveStep(
	step: Record<string, unknown>,
	stepIndex: number
): BlueprintWarning[] {
	const target =
		typeof step.extractToPath === 'string'
			? normalizeWordPressPath(step.extractToPath)
			: '';

	if (
		!target ||
		(!isSensitivePath(target) && !isExecutableSensitivePath(target))
	) {
		return [];
	}

	return [
		{
			severity: isSensitivePath(target) ? 'danger' : 'warning',
			title: 'Extracts files to a sensitive location',
			description: target,
			stepIndex,
		},
	];
}

function sortWarnings(warnings: BlueprintWarning[]): BlueprintWarning[] {
	const severityOrder: Record<BlueprintWarningSeverity, number> = {
		danger: 0,
		warning: 1,
		info: 2,
	};
	return [...warnings].sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity]
	);
}

function previewUrl(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.host ? truncate(parsed.href, 120) : truncate(url, 120);
	} catch {
		return truncate(url, 120);
	}
}

function cleanCodePreview(code: string): string {
	return code
		.replace(/^<\?php\s*/i, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeWordPressPath(path: string): string {
	const normalizedPath = normalizePath(
		path.startsWith('/') ? path : `/${path}`
	);
	return normalizedPath.startsWith('/wordpress/')
		? normalizedPath.slice('/wordpress'.length)
		: normalizedPath;
}

function isSensitivePath(path: string): boolean {
	const normalizedPath = normalizeWordPressPath(path);
	return SENSITIVE_PATHS.some(
		(sensitivePath) =>
			normalizedPath === sensitivePath ||
			normalizedPath.startsWith(sensitivePath)
	);
}

function isExecutableSensitivePath(path: string): boolean {
	const normalizedPath = normalizeWordPressPath(path);
	return EXECUTABLE_SENSITIVE_PATHS.some((sensitivePath) =>
		normalizedPath.startsWith(sensitivePath)
	);
}

function isPhpFile(path: string): boolean {
	const normalizedPath = path.toLowerCase();
	return PHP_EXTENSIONS.some((extension) =>
		normalizedPath.endsWith(extension)
	);
}

function titleCase(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncate(value: string, maxLength: number): string {
	return value.length > maxLength
		? `${value.slice(0, Math.max(0, maxLength - 3))}...`
		: value;
}

const SENSITIVE_PATHS = [
	'/wp-config.php',
	'/.htaccess',
	'/wp-admin/',
	'/wp-includes/',
	'/wp-content/db.php',
	'/wp-content/object-cache.php',
	'/wp-content/advanced-cache.php',
	'/wp-content/sunrise.php',
	'/wp-content/mu-plugins/',
];

const EXECUTABLE_SENSITIVE_PATHS = [
	'/wp-content/uploads/',
	'/wp-content/cache/',
	'/wp-content/upgrade/',
];

const PHP_EXTENSIONS = ['.php', '.phtml', '.php5', '.php7', '.phar'];
