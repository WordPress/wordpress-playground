import fs from 'fs-extra';
import path from 'path';
import { slugify } from './slugify';
import { getPluginFile } from './get-plugin-file';

interface ExtractNameResult {
	name: string;
	slug: string;
}

function extractName(
	pluginFileContent: string,
	nameRegEx: RegExp
): ExtractNameResult | null {
	const match = pluginFileContent.match(nameRegEx);

	if (match) {
		const name = match[1].trim();
		return {
			name,
			slug: slugify(name),
		};
	} else {
		return null;
	}
}

export function extractPluginName(projectPath: string) {
	const pluginFile = getPluginFile(projectPath);
	if (!pluginFile) {
		return null;
	}
	const pluginFileContent = fs.readFileSync(
		path.join(projectPath, pluginFile),
		'utf-8'
	);
	return extractName(pluginFileContent, /Plugin Name:\s*(.*)/i);
}

