import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EXTENSION_NAME_PATTERNS = [
	/\bPHP_ARG_ENABLE\(\s*\[?([A-Za-z0-9_]+)\]?/m,
	/\bPHP_ARG_WITH\(\s*\[?([A-Za-z0-9_]+)\]?/m,
	/\bPHP_NEW_EXTENSION\(\s*\[?([A-Za-z0-9_]+)\]?/m,
];

export async function detectExtensionName(sourceDir: string): Promise<string> {
	const configPath = path.join(sourceDir, 'config.m4');
	let config: string;
	try {
		config = await readFile(configPath, 'utf8');
	} catch (error) {
		throw new Error(
			`Could not read ${configPath}. Pass --name or provide a config.m4 file.`,
			{ cause: error }
		);
	}

	const detected = detectExtensionNameFromConfig(config);
	if (!detected) {
		throw new Error(
			`Could not detect the extension name from ${configPath}. Pass --name explicitly.`
		);
	}
	return detected;
}

export function detectExtensionNameFromConfig(config: string): string | null {
	for (const pattern of EXTENSION_NAME_PATTERNS) {
		const match = pattern.exec(config);
		if (match?.[1]) {
			return match[1];
		}
	}
	return null;
}
