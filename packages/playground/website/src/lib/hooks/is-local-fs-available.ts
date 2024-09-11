import { PlaygroundClient } from '@wp-playground/client';
import { useState, useEffect } from 'react';

export type LocalFsAvailability = true | 'not-available' | 'origin-mismatch';

async function isLocalFsAvailable(
	playground: PlaygroundClient
): Promise<LocalFsAvailability> {
	if (!(window as any).showDirectoryPicker) {
		return 'not-available';
	}
	const isSameOriginAsPlayground =
		new URL(await playground.absoluteUrl).origin === window.location.origin;

	if (!isSameOriginAsPlayground) {
		return 'origin-mismatch';
	}

	return true;
}

export function useIsLocalFsAvailable(playground?: PlaygroundClient) {
	const [isAvailable, setIsAvailable] = useState<LocalFsAvailability | null>(
		null
	);

	useEffect(() => {
		async function check() {
			if (!playground) {
				return;
			}
			setIsAvailable(await isLocalFsAvailable(playground));
		}
		check();
	}, [playground]);

	return isAvailable;
}
