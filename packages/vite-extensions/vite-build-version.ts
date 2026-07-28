import { execSync } from 'node:child_process';
import virtualModule from './vite-virtual-module';

let buildVersion: string | undefined;

export const getBuildVersion = () => {
	if (buildVersion) {
		return buildVersion;
	}

	try {
		buildVersion = execSync('git rev-parse HEAD').toString().trim();
	} catch (e) {
		buildVersion = (new Date().getTime() / 1000).toFixed(0);
	}

	return buildVersion;
};

export const buildVersionPlugin = (name: string) => {
	return virtualModule({
		name,
		content: `
	    export const buildVersion = ${JSON.stringify(getBuildVersion())};`,
	});
};
