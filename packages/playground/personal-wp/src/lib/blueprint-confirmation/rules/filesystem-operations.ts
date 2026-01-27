import type {
	BlueprintRule,
	BlueprintWarning,
	WarningSeverity,
} from '../types';
import {
	isSensitivePath,
	isPhpFile,
	isExecutableSensitivePath,
	normalizePath,
	analyzeFileWrite,
	analyzeFileContent,
} from './file-patterns';

/**
 * Extract string content from various data formats used in blueprints.
 */
function extractContent(data: unknown): string | undefined {
	if (typeof data === 'string') {
		return data;
	}
	if (data && typeof data === 'object') {
		const dataObj = data as Record<string, unknown>;
		// Handle { resource: 'literal', contents: '...' }
		if (dataObj.contents && typeof dataObj.contents === 'string') {
			return dataObj.contents;
		}
		// Handle base64 encoded content
		if (dataObj.resource === 'literal' && dataObj.contents) {
			return String(dataObj.contents);
		}
	}
	return undefined;
}

/**
 * Analyzes filesystem operation steps like writeFile, rm, mkdir, etc.
 *
 * Performs detailed analysis:
 * - Checks if target paths are sensitive (wp-config, wp-includes, etc.)
 * - Detects PHP files being written to suspicious locations (uploads, cache)
 * - Analyzes file content for malicious patterns (backdoors, webshells)
 * - Detects obfuscated code and dangerous functions
 */
export const filesystemOperationsRule: BlueprintRule = {
	name: 'filesystem-operations',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			const stepName = stepObj.step as string;

			// Handle writeFile with content analysis
			if (stepName === 'writeFile') {
				const path = (stepObj.path as string) || '';
				const content = extractContent(stepObj.data);

				const analysis = analyzeFileWrite(path, content);
				warnings.push({
					severity: analysis.severity,
					title: analysis.title,
					description: analysis.reasons.join('\n• '),
					stepIndex: index,
				});
				return;
			}

			// Handle writeFiles (multiple files)
			if (stepName === 'writeFiles') {
				const files = stepObj.files as
					| Record<string, unknown>
					| undefined;
				if (files && typeof files === 'object') {
					for (const [filePath, fileData] of Object.entries(files)) {
						const content = extractContent(fileData);
						const analysis = analyzeFileWrite(filePath, content);
						warnings.push({
							severity: analysis.severity,
							title: analysis.title,
							description: analysis.reasons.join('\n• '),
							stepIndex: index,
						});
					}
				}
				return;
			}

			// Handle delete operations
			if (stepName === 'rm') {
				const path = (stepObj.path as string) || '';
				const normalizedPath = normalizePath(path);
				const sensitive = isSensitivePath(normalizedPath);

				warnings.push({
					severity: sensitive ? 'danger' : 'warning',
					title: sensitive ? 'Delete sensitive file' : 'Delete file',
					description: `Deletes: ${normalizedPath}`,
					stepIndex: index,
				});
				return;
			}

			if (stepName === 'rmdir') {
				const path = (stepObj.path as string) || '';
				const normalizedPath = normalizePath(path);
				const sensitive = isSensitivePath(normalizedPath);

				warnings.push({
					severity: sensitive ? 'danger' : 'warning',
					title: sensitive
						? 'Delete sensitive directory'
						: 'Delete directory',
					description: `Deletes directory: ${normalizedPath}`,
					stepIndex: index,
				});
				return;
			}

			// Handle mkdir
			if (stepName === 'mkdir') {
				const path = (stepObj.path as string) || '';
				warnings.push({
					severity: 'info',
					title: 'Create directory',
					description: `Creates directory: ${normalizePath(path)}`,
					stepIndex: index,
				});
				return;
			}

			// Handle move operations
			if (stepName === 'mv') {
				const fromPath = normalizePath(
					(stepObj.fromPath as string) || ''
				);
				const toPath = normalizePath((stepObj.toPath as string) || '');
				const hasSensitive =
					isSensitivePath(fromPath) || isSensitivePath(toPath);
				const movingPhpToSensitive =
					isPhpFile(toPath) && isExecutableSensitivePath(toPath);

				let severity: WarningSeverity = 'warning';
				let title = 'Move file';

				if (movingPhpToSensitive) {
					severity = 'danger';
					title = 'Move PHP file to suspicious location';
				} else if (hasSensitive) {
					severity = 'danger';
					title = 'Move sensitive file';
				}

				warnings.push({
					severity,
					title,
					description: `Moves from ${fromPath} to ${toPath}`,
					stepIndex: index,
				});
				return;
			}

			// Handle copy operations
			if (stepName === 'cp') {
				const fromPath = normalizePath(
					(stepObj.fromPath as string) || ''
				);
				const toPath = normalizePath((stepObj.toPath as string) || '');
				const hasSensitive =
					isSensitivePath(fromPath) || isSensitivePath(toPath);
				const copyingPhpToSensitive =
					isPhpFile(toPath) && isExecutableSensitivePath(toPath);

				let severity: WarningSeverity = 'info';
				let title = 'Copy file';

				if (copyingPhpToSensitive) {
					severity = 'danger';
					title = 'Copy PHP file to suspicious location';
				} else if (hasSensitive) {
					severity = 'danger';
					title = 'Copy to sensitive location';
				}

				warnings.push({
					severity,
					title,
					description: `Copies from ${fromPath} to ${toPath}`,
					stepIndex: index,
				});
				return;
			}

			// Handle unzip - could extract PHP files anywhere
			if (stepName === 'unzip') {
				const extractTo = normalizePath(
					(stepObj.extractToPath as string) || ''
				);
				const sensitive = isSensitivePath(extractTo);
				const phpSuspicious = isExecutableSensitivePath(extractTo);

				let severity: WarningSeverity = 'warning';
				let title = 'Extract archive';

				if (sensitive) {
					severity = 'danger';
					title = 'Extract archive to sensitive location';
				} else if (phpSuspicious) {
					severity = 'warning';
					title = 'Extract archive (may contain PHP)';
				}

				warnings.push({
					severity,
					title,
					description: `Extracts archive to: ${extractTo}`,
					stepIndex: index,
				});
			}
		});

		return warnings;
	},
};
