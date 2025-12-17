import { useEffect, useCallback, useState, useRef } from 'react';

const KAPA_WEBSITE_ID = 'a8b85529-1773-4710-b35f-c9ebc70ffcb6';

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

const KAPA_SCRIPT_ID = 'kapa-widget-script';

export function useKapaAI() {
	const [isLoaded, setIsLoaded] = useState(false);
	const hasSubmittedQuery = useRef(false);

	useEffect(() => {
		// Check if script already exists
		if (document.getElementById(KAPA_SCRIPT_ID)) {
			if (window.Kapa) {
				setIsLoaded(true);
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
					setIsLoaded(true);
				}
			}, 100);

			setTimeout(() => clearInterval(checkKapa), 5000);
		};

		document.body.appendChild(script);
	}, []);

	const openWithQuery = useCallback((query: string) => {
		if (window.Kapa) {
			if (hasSubmittedQuery.current) {
				window.Kapa.open();
			} else {
				window.Kapa.open({
					mode: 'ai',
					query: `Suggest a solution or troubleshooting steps for the following error: ${query}`,
					submit: true,
				});
				hasSubmittedQuery.current = true;
			}
		}
	}, []);

	return {
		isLoaded,
		openWithQuery,
	};
}
