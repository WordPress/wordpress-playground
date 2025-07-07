import { useState, useEffect } from 'react';
import { usePlaygroundClient } from '../../../lib/use-playground-client';

export function useSupportedWordPressVersions() {
	const [supportedWPVersions, setSupportedWPVersions] = useState<
		Record<string, string>
	>({});
	const [latestWPVersion, setLatestWPVersion] = useState<string | null>(null);

	const playground = usePlaygroundClient();
	useEffect(() => {
		playground?.getMinifiedWordPressVersions().then(({ all, latest }) => {
			const formOptions: Record<string, string> = {};
			for (const version of Object.keys(all)) {
				if (version === 'beta') {
					// Don't show beta versions related to supported major releases
					if (!(all.beta.substring(0, 3) in all)) {
						formOptions[version] = all.beta;
					}
				} else {
					formOptions[version] = version;
				}
			}
			setSupportedWPVersions(formOptions);
			setLatestWPVersion(latest);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!playground]);

	return {
		supportedWPVersions,
		latestWPVersion,
	};
}
