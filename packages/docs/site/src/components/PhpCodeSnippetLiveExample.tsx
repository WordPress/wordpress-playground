import React, { useEffect, useState } from 'react';
import type { ExampleName } from './PhpCodeSnippetLiveExample.examples';

// In dev, load the local Playground website script so docs previews exercise
// uncommitted php-code-snippet.js changes. Production docs still use the hosted
// script and keep a query string to avoid stale one-year browser caches.
const SCRIPT_URL =
	process.env.NODE_ENV === 'development'
		? 'http://127.0.0.1:5400/website-server/php-code-snippet.js'
		: 'https://playground.wordpress.net/php-code-snippet.js?v=selected-text-visible';

function usePhpSnippetScript() {
	useEffect(() => {
		if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
			return;
		}

		const script = document.createElement('script');
		script.type = 'module';
		script.src = SCRIPT_URL;
		document.head.appendChild(script);
	}, []);
}

function usePhpSnippetExample(name: ExampleName) {
	const [html, setHtml] = useState<string>();

	useEffect(() => {
		let isCurrent = true;

		setHtml(undefined);
		void import('./PhpCodeSnippetLiveExample.examples').then(
			({ examples }) => {
				if (isCurrent) {
					setHtml(examples[name]);
				}
			}
		);

		return () => {
			isCurrent = false;
		};
	}, [name]);

	return html;
}

function PhpCodeSnippetPreview({ name }: { name: ExampleName }) {
	usePhpSnippetScript();

	const html = usePhpSnippetExample(name);
	if (!html) {
		return null;
	}

	return (
		<div
			className="php-code-snippet-live-example"
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

export function PhpCodeSnippetExample({ name }: { name: ExampleName }) {
	return <PhpCodeSnippetPreview name={name} />;
}

export default function PhpCodeSnippetLiveExample() {
	return <PhpCodeSnippetPreview name="full" />;
}
