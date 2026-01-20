/**
 * Standalone entry point for the WordPress Playground Block Demo.
 *
 * This page replicates the full-page view functionality that was previously
 * served by the WordPress plugin (playground_demo_maybe_render_full_page_block).
 * It reads configuration from URL query parameters and renders an interactive
 * code editor with a live WordPress Playground preview.
 *
 * URL parameters:
 * - playground-full-page: Must be present to indicate full page mode
 * - playground-attributes: Base64-encoded JSON string containing block attributes
 */

import { createRoot } from 'react-dom/client';
import PlaygroundPreview from './components/playground-preview';
import { base64DecodeBlockAttributes, base64ToString } from './base64';
import './styles.scss';

function renderPlaygroundPreview() {
	const rootElement = document.getElementById('root');
	if (!rootElement) {
		// eslint-disable-next-line no-console
		console.error('Root element not found');
		return;
	}

	const urlParams = new URLSearchParams(window.location.search);

	// Check for full-page mode with attributes in URL
	if (
		urlParams.has('playground-full-page') &&
		urlParams.has('playground-attributes')
	) {
		const encodedAttributes = urlParams.get('playground-attributes')!;
		try {
			const attributeJson = base64ToString(encodedAttributes);
			const attributes = base64DecodeBlockAttributes(
				JSON.parse(attributeJson)
			);

			const root = createRoot(rootElement);
			root.render(
				<PlaygroundPreview {...attributes} inFullPageView={true} />
			);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to parse playground attributes:', error);
			rootElement.innerHTML = `
				<div style="padding: 20px; font-family: sans-serif;">
					<h1>Error Loading Playground</h1>
					<p>Failed to parse the playground configuration from the URL.</p>
					<p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
				</div>
			`;
		}
	} else if (urlParams.has('playground-attributes')) {
		// Attributes without full-page mode - render normally
		const encodedAttributes = urlParams.get('playground-attributes')!;
		try {
			const attributeJson = base64ToString(encodedAttributes);
			const attributes = base64DecodeBlockAttributes(
				JSON.parse(attributeJson)
			);

			const root = createRoot(rootElement);
			root.render(
				<PlaygroundPreview
					{...attributes}
					baseAttributesForFullPageView={attributes}
				/>
			);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to parse playground attributes:', error);
			rootElement.innerHTML = `
				<div style="padding: 20px; font-family: sans-serif;">
					<h1>Error Loading Playground</h1>
					<p>Failed to parse the playground configuration from the URL.</p>
				</div>
			`;
		}
	} else {
		// No attributes - render with default configuration
		const root = createRoot(rootElement);
		root.render(
			<PlaygroundPreview
				codeEditor={true}
				codeEditorReadOnly={false}
				codeEditorSideBySide={true}
				codeEditorTranspileJsx={false}
				codeEditorMultipleFiles={true}
				codeEditorMode="plugin"
				logInUser={true}
				landingPageUrl="/"
				createNewPost={false}
				createNewPostType="post"
				createNewPostTitle="New post"
				createNewPostContent=""
				redirectToPost={false}
				redirectToPostType="front"
				blueprint=""
				blueprintUrl=""
				configurationSource="block-attributes"
				requireLivePreviewActivation={true}
				codeEditorErrorLog={false}
				constants={{}}
				files={[
					{
						name: 'plugin.php',
						contents: `<?php
/**
 * Plugin Name: My first plugin
 */

add_filter('the_content', function($content) {
    return '<h1>Hello from my plugin!</h1>' . $content;
});
`,
					},
				]}
				inFullPageView={false}
				baseAttributesForFullPageView={{}}
			/>
		);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', renderPlaygroundPreview);
} else {
	renderPlaygroundPreview();
}
