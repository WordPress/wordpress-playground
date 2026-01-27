import type { BlueprintRule, BlueprintWarning, WarningSeverity } from '../types';

/**
 * Sensitive paths that warrant danger severity when modified.
 */
const SENSITIVE_PATHS = [
	'/wp-config.php',
	'/wp-includes/',
	'/wp-admin/',
	'/.htaccess',
	'/wp-content/db.php',
	'/wp-content/object-cache.php',
	'/wp-content/advanced-cache.php',
];

/**
 * Check if a path is sensitive and warrants danger severity.
 */
function isSensitivePath(path: string): boolean {
	const normalizedPath = path.startsWith('/') ? path : '/' + path;
	return SENSITIVE_PATHS.some(
		(sensitive) =>
			normalizedPath === sensitive ||
			normalizedPath.startsWith(sensitive)
	);
}

/**
 * Analyzes filesystem operation steps like writeFile, rm, mkdir, etc.
 *
 * - Normal paths: warning severity
 * - Sensitive paths (wp-config.php, wp-includes, etc.): danger severity
 */
export const filesystemOperationsRule: BlueprintRule = {
	name: 'filesystem-operations',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		const filesystemSteps = [
			'writeFile',
			'rm',
			'rmdir',
			'mkdir',
			'mv',
			'cp',
		];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			const stepName = stepObj.step as string;

			if (!filesystemSteps.includes(stepName)) {
				return;
			}

			const path = (stepObj.path as string) || '';
			const fromPath = (stepObj.fromPath as string) || '';
			const toPath = (stepObj.toPath as string) || '';

			const affectedPaths = [path, fromPath, toPath].filter(Boolean);
			const hasSensitivePath = affectedPaths.some(isSensitivePath);
			const severity: WarningSeverity = hasSensitivePath
				? 'danger'
				: 'warning';

			switch (stepName) {
				case 'writeFile':
					warnings.push({
						severity,
						title: hasSensitivePath
							? 'Write to sensitive file'
							: 'Write file',
						description: `Writes to: ${path}`,
						stepIndex: index,
					});
					break;
				case 'rm':
					warnings.push({
						severity,
						title: hasSensitivePath
							? 'Delete sensitive file'
							: 'Delete file',
						description: `Deletes: ${path}`,
						stepIndex: index,
					});
					break;
				case 'rmdir':
					warnings.push({
						severity,
						title: hasSensitivePath
							? 'Delete sensitive directory'
							: 'Delete directory',
						description: `Deletes directory: ${path}`,
						stepIndex: index,
					});
					break;
				case 'mkdir':
					warnings.push({
						severity: 'info',
						title: 'Create directory',
						description: `Creates directory: ${path}`,
						stepIndex: index,
					});
					break;
				case 'mv':
					warnings.push({
						severity,
						title: hasSensitivePath
							? 'Move sensitive file'
							: 'Move file',
						description: `Moves from ${fromPath} to ${toPath}`,
						stepIndex: index,
					});
					break;
				case 'cp':
					warnings.push({
						severity: hasSensitivePath ? severity : 'info',
						title: hasSensitivePath
							? 'Copy to sensitive location'
							: 'Copy file',
						description: `Copies from ${fromPath} to ${toPath}`,
						stepIndex: index,
					});
					break;
			}
		});

		return warnings;
	},
};
