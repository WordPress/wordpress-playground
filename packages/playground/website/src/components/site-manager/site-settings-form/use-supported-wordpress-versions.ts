import { useState, useEffect } from 'react';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { logger } from '@php-wasm/logger';

export function useSupportedWordPressVersions() {
	const [supportedWPVersions, setSupportedWPVersions] = useState<
		Record<string, string>
	>({});
	const [latestWPVersion, setLatestWPVersion] = useState<string | null>(null);

	const playground = usePlaygroundClient();
	useEffect(() => {
		if (!playground) {
			setSupportedWPVersions({});
			setLatestWPVersion(null);
			return;
		}
		let cancelled = false;
		setSupportedWPVersions({});
		setLatestWPVersion(null);
		void playground
			.getMinifiedWordPressVersions()
			.then(({ all, latest }) => {
				if (cancelled) {
					return;
				}
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
			})
			.catch((error) => {
				if (!cancelled) {
					logger.error(
						'Could not load supported WordPress versions',
						error
					);
					setSupportedWPVersions({});
					setLatestWPVersion(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [playground]);

	return {
		supportedWPVersions,
		latestWPVersion,
	};
}
