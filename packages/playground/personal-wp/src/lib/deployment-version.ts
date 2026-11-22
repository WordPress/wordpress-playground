import { buildVersion } from './config';
import { getAppBaseUrl } from './state/url/app-base-url';

let deploymentVersion: Promise<string> | undefined;

/** Check once per document; offline tabs keep using their cached build. */
export function getDeploymentVersion(): Promise<string> {
	deploymentVersion ??= fetch(
		new URL('personal-wp-version.json', getAppBaseUrl()),
		{
			cache: 'no-store',
		}
	)
		.then(async (response) => {
			if (!response.ok) return buildVersion;
			const manifest = await response.json();
			return typeof manifest.buildVersion === 'string' &&
				manifest.buildVersion
				? manifest.buildVersion
				: buildVersion;
		})
		.catch(() => buildVersion);
	return deploymentVersion;
}
