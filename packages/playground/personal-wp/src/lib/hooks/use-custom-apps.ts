import { useState, useEffect, useCallback } from 'react';

export type CustomApp = {
	id: string;
	title: string;
	description: string;
	author?: string;
	blueprintUrl: string;
};

const STORAGE_KEY = 'wp-playground-custom-apps';

function loadCustomApps(): CustomApp[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const apps = JSON.parse(stored);
		// eslint-disable-next-line no-console
		console.log('[CustomApps] Loaded from localStorage:', apps);
		return apps;
	} catch {
		return [];
	}
}

function saveCustomApps(apps: CustomApp[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
	} catch {
		// Storage full or unavailable
	}
}

export function useCustomApps() {
	const [customApps, setCustomApps] = useState<CustomApp[]>(() =>
		loadCustomApps()
	);

	useEffect(() => {
		saveCustomApps(customApps);
	}, [customApps]);

	const addApp = useCallback((app: Omit<CustomApp, 'id'>) => {
		setCustomApps((prev) => {
			const existingIndex = prev.findIndex(
				(a) => a.title.toLowerCase() === app.title.toLowerCase()
			);

			if (existingIndex !== -1) {
				const updated = [...prev];
				updated[existingIndex] = {
					...app,
					id: prev[existingIndex].id,
				};
				// eslint-disable-next-line no-console
				console.log(
					'[CustomApps] Replacing app:',
					updated[existingIndex]
				);
				return updated;
			}

			const newApp: CustomApp = {
				...app,
				id: crypto.randomUUID(),
			};
			// eslint-disable-next-line no-console
			console.log('[CustomApps] Adding app:', newApp);
			return [...prev, newApp];
		});
	}, []);

	const removeApp = useCallback((id: string) => {
		// eslint-disable-next-line no-console
		console.log('[CustomApps] Removing app:', id);
		setCustomApps((prev) => prev.filter((app) => app.id !== id));
	}, []);

	return {
		customApps,
		addApp,
		removeApp,
	};
}
