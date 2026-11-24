import { useEffect, useState } from 'react';

const STORAGE_KEY = 'playground-developer-tools';

/** Reveals externally opened tools without changing the user's saved preference. */
export function useDeveloperTools({
	developerPaneOpen,
	paneCloseBlocked,
	onCloseDeveloperPane,
}: {
	developerPaneOpen: boolean;
	paneCloseBlocked: boolean;
	onCloseDeveloperPane: () => void;
}) {
	const [isVisible, setIsVisible] = useState(readPreference);
	useEffect(() => {
		if (developerPaneOpen) {
			setIsVisible(true);
		}
	}, [developerPaneOpen]);

	function toggle() {
		if (paneCloseBlocked) {
			return;
		}
		const next = !isVisible;
		if (!next && developerPaneOpen) {
			onCloseDeveloperPane();
		}
		setIsVisible(next);
		try {
			if (next) {
				localStorage.setItem(STORAGE_KEY, 'true');
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		} catch {
			// The current session still works when browser storage is unavailable.
		}
	}

	return { isVisible, toggle };
}

function readPreference() {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}
