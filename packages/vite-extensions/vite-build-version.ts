import { execSync } from 'node:child_process';
import virtualModule from './vite-virtual-module';

export const buildVersionPlugin = () => {
	let buildVersion: string;
	try {
		buildVersion = execSync('git rev-parse HEAD').toString().trim();
	} catch (e) {
		if (import.meta.env.MODE !== 'development') {
			// Within a single production build of all Playground packages,
			// we need the version string to be constant, so we cannot use
			// the current timestamp which will be different for each package build.
			// This assumes `git` is present during production builds,
			// but I think it is a reasonable assumption for this project.
			throw new Error('Failed to get build version: ' + e);
		}

		buildVersion = (new Date().getTime() / 1000).toFixed(0);
	}

	return virtualModule({
		name: 'build-version',
		content: `
    export const buildVersion = ${JSON.stringify(buildVersion)};`,
	});
};
