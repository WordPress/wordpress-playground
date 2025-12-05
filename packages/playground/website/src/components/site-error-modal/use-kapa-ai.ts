import { useEffect, useCallback, useState } from 'react';
// @ts-ignore - Virtual module injected by Vite
import { kapaWebsiteId } from 'virtual:kapa-ai-config';

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
	const isConfigured = Boolean(kapaWebsiteId);

	useEffect(() => {
		if (!isConfigured) {
			return;
		}

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
		script.setAttribute('data-website-id', kapaWebsiteId);
		script.setAttribute('data-project-name', 'WordPress Playground');
		script.setAttribute('data-project-color', '#3858e9');
		script.setAttribute(
			'data-project-logo',
			'https://playground.wordpress.net/logo-square.png'
		);
		script.setAttribute('data-button-hide', 'true');

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
	}, [isConfigured]);

	const openWithQuery = useCallback((query: string) => {
		if (window.Kapa) {
			window.Kapa.open({
				mode: 'ai',
				query: `Suggest a solution or troubleshooting steps for the following error: ${query}`,
				submit: true,
			});

			// Move widget container inside screen overlay so it appears on top
			const moveContainer = () => {
				const container = document.getElementById(
					'kapa-widget-container'
				);
				const overlay = document.querySelector(
					'.components-modal__screen-overlay'
				);
				if (container && overlay) {
					overlay.insertBefore(container, overlay.firstChild);
				} else {
					setTimeout(moveContainer, 50);
				}
			};
			setTimeout(moveContainer, 50);
		}
	}, []);

	return {
		isConfigured,
		isLoaded,
		openWithQuery,
	};
}
