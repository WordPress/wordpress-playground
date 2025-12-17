import { useCallback, useRef } from 'react';

const KAPA_WEBSITE_ID = 'a8b85529-1773-4710-b35f-c9ebc70ffcb6';
const KAPA_SCRIPT_ID = 'kapa-widget-script';

declare global {
	interface Window {
		Kapa?: {
			open: (options?: {
				mode?: 'ai' | 'search';
				query?: string;
				submit?: boolean;
			}) => void;
			close: () => void;
			render: (options?: { onRender?: () => void }) => void;
			unmount: () => void;
		};
	}
}

function loadKapaScript(): Promise<void> {
	return new Promise((resolve) => {
		// Check if script already exists and loaded
		if (document.getElementById(KAPA_SCRIPT_ID)) {
			if (window.Kapa) {
				resolve();
			} else {
				// Script exists but not loaded yet, wait for it
				const checkKapa = setInterval(() => {
					if (window.Kapa) {
						clearInterval(checkKapa);
						resolve();
					}
				}, 100);
				setTimeout(() => clearInterval(checkKapa), 5000);
			}
			return;
		}

		const script = document.createElement('script');
		script.id = KAPA_SCRIPT_ID;
		script.src = 'https://widget.kapa.ai/kapa-widget.bundle.js';
		script.async = true;
		script.setAttribute('data-website-id', KAPA_WEBSITE_ID);
		script.setAttribute(
			'data-project-name',
			'WordPress Playground AI Assistant'
		);
		script.setAttribute('data-project-color', '#3858e9');
		script.setAttribute(
			'data-project-logo',
			'https://wordpress.github.io/wordpress-playground/img/playground-logo.svg'
		);
		script.setAttribute('data-button-hide', 'true');
		script.setAttribute('data-modal-z-index', '100001');
		script.setAttribute('data-scale-factor', '1.3');

		script.onload = () => {
			const checkKapa = setInterval(() => {
				if (window.Kapa) {
					clearInterval(checkKapa);
					resolve();
				}
			}, 100);
			setTimeout(() => clearInterval(checkKapa), 5000);
		};

		document.body.appendChild(script);
	});
}

export function useKapaAI() {
	const hasSubmittedQuery = useRef(false);
	const isEnabled = () => {
		return (
			window.location.hostname === 'playground.wordpress.net' ||
			process.env.NODE_ENV === 'development'
		);
	};

	const openWithErrorMessage = useCallback(async (errorMessage: string) => {
		if (!isEnabled()) {
			return;
		}

		await loadKapaScript();

		if (window.Kapa) {
			if (hasSubmittedQuery.current) {
				window.Kapa.open();
			} else {
				const urlParams = new URLSearchParams(window.location.search);
				const hasExternalBlueprint = urlParams.has('blueprint-url');
				const contextPrefix = hasExternalBlueprint
					? ''
					: `Given the URL query parameters ${window.location.search}, `;

				window.Kapa.open({
					mode: 'ai',
					query: `${contextPrefix}Suggest a solution or troubleshooting steps for the following error: ${errorMessage}`,
					submit: true,
				});
				hasSubmittedQuery.current = true;
			}
		}
	}, []);

	return {
		isEnabled,
		openWithErrorMessage,
	};
}
