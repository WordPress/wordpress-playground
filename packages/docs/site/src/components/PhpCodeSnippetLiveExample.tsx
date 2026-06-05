import React, { useEffect, useState } from 'react';
import type { ExampleName } from './PhpCodeSnippetLiveExample.examples';

// php-code-snippet.js used to be served with a one-year browser cache.
// Keep this query so docs previews don't reuse stale pre-editable-default copies.
const SCRIPT_URL =
	'https://playground.wordpress.net/php-code-snippet.js?v=editable-by-default';

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
