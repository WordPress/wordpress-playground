import { execSync } from 'node:child_process';
import virtualModule from './vite-virtual-module';

export const buildVersionPlugin = (name: string) => {
	let buildVersion: string;
	try {
		buildVersion = execSync('git rev-parse HEAD').toString().trim();
	} catch (e) {
		buildVersion = (new Date().getTime() / 1000).toFixed(0);
	}

	return virtualModule({
		name,
		content: `
    export const buildVersion = ${JSON.stringify(buildVersion)};`,
	});
};
