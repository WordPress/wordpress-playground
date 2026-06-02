/**
 * E2E tests for the playground-block-frame.html page.
 *
 * This page provides an interactive code editor with live WordPress Playground preview,
 * supporting multi-file editing with syntax highlighting, JSX transpilation with
 * esbuild-wasm, and URL parameter support for sharing configurations.
 */

import { test, expect } from '../playground-block-fixtures';

/**
 * Test 1: Simple Code Editor (PHP Plugin)
 *
 * Shows a basic PHP plugin with code editor and live preview side-by-side.
 * The plugin outputs "Hello from the plugin" in the WordPress frontend.
 */
test.describe('Simple Code Editor (PHP Plugin)', () => {
	const simplePluginUrl =
		'./playground-block-frame.html?playground-full-page=&playground-attributes=eyJjb2RlRWRpdG9yIjp0cnVlLCJjb2RlRWRpdG9yVHJhbnNwaWxlSnN4IjpmYWxzZSwiZmlsZXMiOlsiVzNzaWJtRnRaU0k2SW5Cc2RXZHBiaTV3YUhBaUxDSmpiMjUwWlc1MGN5STZJandcL2NHaHdYRzR2S2lwY2JpQXFJRkJzZFdkcGJpQk9ZVzFsT2lCWGIzSmtVSEpsYzNNZ1JHVnRieUJRYkhWbmFXNWNiaUFxTDF4dVhHNWhaR1JmWVdOMGFXOXVLQ2QzY0Y5b1pXRmtKeXdnWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnWldOb2J5QW5QR2d4UGtobGJHeHZJR1p5YjIwZ2RHaGxJSEJzZFdkcGJqd3ZhREUrUEdKeVBqeGljajQ4WW5JK1BHSnlQaWM3WEc1OUtUdGNiaUo5WFE9PSJdLCJjb2RlRWRpdG9yU2lkZUJ5U2lkZSI6dHJ1ZSwiY29kZUVkaXRvck11bHRpcGxlRmlsZXMiOmZhbHNlLCJjb2RlRWRpdG9yTW9kZSI6InBsdWdpbiIsImxvZ0luVXNlciI6dHJ1ZSwiY29uZmlndXJhdGlvblNvdXJjZSI6ImJsb2NrLWF0dHJpYnV0ZXMiLCJyZXF1aXJlTGl2ZVByZXZpZXdBY3RpdmF0aW9uIjpmYWxzZSwiY29uc3RhbnRzIjp7ImEiOiJiIn19';

	test('should display code editor with PHP plugin code', async ({
		playgroundBlock,
	}) => {
		await playgroundBlock.goto(simplePluginUrl);

		// Verify the code editor is visible
		await playgroundBlock.waitForCodeEditor();
		const isEditorVisible = await playgroundBlock.isCodeEditorVisible();
		expect(isEditorVisible).toBe(true);

		// Verify the editor contains the plugin code
		const editorContent = await playgroundBlock.getCodeEditorContent();
		expect(editorContent).toContain('Plugin Name');
		expect(editorContent).toContain('add_action');
	});

	test('should render WordPress with plugin output', async ({
		playgroundBlock,
		wordpress,
	}) => {
		await playgroundBlock.goto(simplePluginUrl);

		// Verify WordPress is loaded and shows the plugin output
		await expect(wordpress.locator('body')).toContainText(
			'Hello from the plugin',
			{ timeout: 60000 }
		);
	});

	test('should display side-by-side layout', async ({ playgroundBlock }) => {
		await playgroundBlock.goto(simplePluginUrl);

		// Verify both code editor and preview are visible (side-by-side mode)
		await playgroundBlock.waitForCodeEditor();
		const codeEditor = playgroundBlock.page.locator('.cm-editor');
		const playgroundIframe =
			playgroundBlock.page.locator('.playground-iframe');

		await expect(codeEditor).toBeVisible();
		await expect(playgroundIframe).toBeVisible();
	});
});

/**
 * Test 2: JSX Transpilation (Interactive React Counter)
 *
 * Demonstrates JSX transpilation with a multi-file plugin containing a React component.
 * The plugin registers a shortcode that renders a React component greeting.
 */
test.describe('JSX Transpilation', () => {
	const jsxPluginUrl =
		'./playground-block-frame.html?playground-full-page=&playground-attributes=eyJjb2RlRWRpdG9yIjp0cnVlLCJjb2RlRWRpdG9yVHJhbnNwaWxlSnN4Ijp0cnVlLCJmaWxlcyI6WyJXM3NpYm1GdFpTSTZJbkJzZFdkcGJpNXdhSEFpTENKamIyNTBaVzUwY3lJNklqdy9jR2h3WEc0dktpcGNiaUFxSUZCc2RXZHBiaUJPWVcxbE9pQktVMWdnUkdWdGJ5QlFiSFZuYVc1Y2JpQXFJRVJsYzJOeWFYQjBhVzl1T2lCRVpXMXZibk4wY21GMFpYTWdTbE5ZSUhSeVlXNXpjR2xzWVhScGIyNGdhVzRnVjI5eVpGQnlaWE56SUZCc1lYbG5jbTkxYm1SY2JpQXFMMXh1WEc1aFpHUmZZV04wYVc5dUtDZDNjRjlsYm5GMVpYVmxYM05qY21sd2RITW5MQ0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0IzY0Y5bGJuRjFaWFZsWDNOamNtbHdkQ2hjYmlBZ0lDQWdJQ0FnSjJwemVDMWtaVzF2Snl4Y2JpQWdJQ0FnSUNBZ2NHeDFaMmx1YzE5MWNtd29KM1pwWlhjdWFuTW5MQ0JmWDBaSlRFVmZYeWtzWEc0Z0lDQWdJQ0FnSUdGeWNtRjVLQ2QzY0MxbGJHVnRaVzUwSnlrc1hHNGdJQ0FnSUNBZ0lDY3hMakFuTEZ4dUlDQWdJQ0FnSUNCMGNuVmxYRzRnSUNBZ0tUdGNibjBwTzF4dVhHNWhaR1JmYzJodmNuUmpiMlJsS0NkcWMzaGZaR1Z0Ynljc0lHWjFibU4wYVc5dUtDa2dlMXh1SUNBZ0lISmxkSFZ5YmlBblBHUnBkaUJwWkQxY0ltcHplQzFrWlcxdkxYSnZiM1JjSWo0OEwyUnBkajRuTzF4dWZTazdYRzRpZlN4N0ltNWhiV1VpT2lKMmFXVjNMbXB6SWl3aVkyOXVkR1Z1ZEhNaU9pSmpiMjV6ZENCN0lHTnlaV0YwWlVWc1pXMWxiblFzSUhKbGJtUmxjaUI5SUQwZ2QzQXVaV3hsYldWdWREdGNibHh1WTI5dWMzUWdSM0psWlhScGJtY2dQU0FvZXlCdVlXMWxJSDBwSUQwK0lDaGNiaUFnSUNBOFpHbDJJSE4wZVd4bFBYdDdJSEJoWkdScGJtYzZJQ2N5TUhCNEp5d2dZbUZqYTJkeWIzVnVaRG9nSnlObU1HWXdaakFuTENCaWIzSmtaWEpTWVdScGRYTTZJQ2M0Y0hnbkxDQnRZWEpuYVc0NklDY3lNSEI0SURBbklIMTlQbHh1SUNBZ0lDQWdJQ0E4YURJK1NHVnNiRzhnWm5KdmJTQktVMWdoUEM5b01qNWNiaUFnSUNBZ0lDQWdQSEErVkdocGN5QmpiMjF3YjI1bGJuUWdkMkZ6SUhSeVlXNXpjR2xzWldRZ1puSnZiU0JoSUR4emRISnZibWMrTG1welBDOXpkSEp2Ym1jK0lHWnBiR1VnZDJsMGFDQktVMWdnYzNsdWRHRjRMand2Y0Q1Y2JpQWdJQ0FnSUNBZ1BIQStWMlZzWTI5dFpTd2dlMjVoYldWOUlUd3ZjRDVjYmlBZ0lDQThMMlJwZGo1Y2JpazdYRzVjYm1SdlkzVnRaVzUwTG1Ga1pFVjJaVzUwVEdsemRHVnVaWElvSjBSUFRVTnZiblJsYm5STWIyRmtaV1FuTENBb0tTQTlQaUI3WEc0Z0lDQWdZMjl1YzNRZ2NtOXZkQ0E5SUdSdlkzVnRaVzUwTG1kbGRFVnNaVzFsYm5SQ2VVbGtLQ2RxYzNndFpHVnRieTF5YjI5MEp5azdYRzRnSUNBZ2FXWWdLSEp2YjNRcElIdGNiaUFnSUNBZ0lDQWdjbVZ1WkdWeUtEeEhjbVZsZEdsdVp5QnVZVzFsUFZ3aVYyOXlaRkJ5WlhOeklFUmxkbVZzYjNCbGNsd2lJQzgrTENCeWIyOTBLVHRjYmlBZ0lDQjlYRzU5S1R0Y2JpSjlYUT09Il0sImNvZGVFZGl0b3JTaWRlQnlTaWRlIjp0cnVlLCJjb2RlRWRpdG9yTXVsdGlwbGVGaWxlcyI6dHJ1ZSwiY29kZUVkaXRvck1vZGUiOiJwbHVnaW4iLCJsb2dJblVzZXIiOnRydWUsImxhbmRpbmdQYWdlVXJsIjoiLz9wPTEiLCJjcmVhdGVOZXdQb3N0Ijp0cnVlLCJjcmVhdGVOZXdQb3N0VHlwZSI6InBvc3QiLCJjcmVhdGVOZXdQb3N0VGl0bGUiOiJKU1ggRGVtbyIsImNyZWF0ZU5ld1Bvc3RDb250ZW50IjoiW2pzeF9kZW1vXSIsInJlZGlyZWN0VG9Qb3N0Ijp0cnVlLCJyZWRpcmVjdFRvUG9zdFR5cGUiOiJmcm9udCIsImNvbmZpZ3VyYXRpb25Tb3VyY2UiOiJibG9jay1hdHRyaWJ1dGVzIiwicmVxdWlyZUxpdmVQcmV2aWV3QWN0aXZhdGlvbiI6ZmFsc2V9';

	test('should display code editor with multiple file tabs', async ({
		playgroundBlock,
	}) => {
		await playgroundBlock.goto(jsxPluginUrl);

		// Verify the code editor is visible
		await playgroundBlock.waitForCodeEditor();
		const isEditorVisible = await playgroundBlock.isCodeEditorVisible();
		expect(isEditorVisible).toBe(true);

		// Verify multiple file tabs are present
		// Use a specific button selector for file tabs
		const tabs = playgroundBlock.page.locator('button.file-tab');
		const tabCount = await tabs.count();
		// Should have at least 2 file tabs for the multi-file JSX example
		expect(tabCount).toBeGreaterThanOrEqual(2);
	});

	test('should transpile JSX and render React component', async ({
		playgroundBlock,
		wordpress,
	}) => {
		await playgroundBlock.goto(jsxPluginUrl);

		// Verify WordPress is loaded with the transpiled React component
		// The JSX component renders "Hello from JSX!" and a greeting message
		await expect(wordpress.locator('body')).toContainText(
			'Hello from JSX',
			{
				timeout: 120000,
			}
		);
	});

	test('should contain JSX syntax in the view.js file', async ({
		playgroundBlock,
	}) => {
		await playgroundBlock.goto(jsxPluginUrl);

		await playgroundBlock.waitForCodeEditor();

		// Click on view.js tab
		const viewJsTab = playgroundBlock.page.locator(
			'button.file-tab[aria-label="File: view.js"]'
		);
		await viewJsTab.click();
		await playgroundBlock.page.waitForTimeout(500);

		// Verify the editor contains JSX syntax
		const editorContent = await playgroundBlock.getCodeEditorContent();
		// JSX files contain createElement or JSX syntax like <div>
		expect(
			editorContent.includes('createElement') ||
				editorContent.includes('<div') ||
				editorContent.includes('<h2')
		).toBe(true);
	});
});

/**
 * Test 3: Full Page Playground Only (No Editor)
 *
 * Shows WordPress Playground without the code editor - just the live WordPress instance.
 */
test.describe('Full Page Playground Only (No Editor)', () => {
	const playgroundOnlyUrl =
		'./playground-block-frame.html?playground-full-page&playground-attributes=eyJjb2RlRWRpdG9yIjpmYWxzZSwiY29kZUVkaXRvclJlYWRPbmx5IjpmYWxzZSwiY29kZUVkaXRvclNpZGVCeVNpZGUiOmZhbHNlLCJjb2RlRWRpdG9yVHJhbnNwaWxlSnN4IjpmYWxzZSwiY29kZUVkaXRvck11bHRpcGxlRmlsZXMiOmZhbHNlLCJjb2RlRWRpdG9yTW9kZSI6InBsdWdpbiIsImxvZ0luVXNlciI6dHJ1ZSwibGFuZGluZ1BhZ2VVcmwiOiIvd3AtYWRtaW4vIiwiY3JlYXRlTmV3UG9zdCI6ZmFsc2UsImNyZWF0ZU5ld1Bvc3RUeXBlIjoicG9zdCIsImNyZWF0ZU5ld1Bvc3RUaXRsZSI6IiIsImNyZWF0ZU5ld1Bvc3RDb250ZW50IjoiIiwicmVkaXJlY3RUb1Bvc3QiOmZhbHNlLCJyZWRpcmVjdFRvUG9zdFR5cGUiOiJmcm9udCIsImJsdWVwcmludCI6IiIsImJsdWVwcmludFVybCI6IiIsImNvbmZpZ3VyYXRpb25Tb3VyY2UiOiJibG9jay1hdHRyaWJ1dGVzIiwicmVxdWlyZUxpdmVQcmV2aWV3QWN0aXZhdGlvbiI6ZmFsc2UsImNvZGVFZGl0b3JFcnJvckxvZyI6ZmFsc2UsImNvbnN0YW50cyI6ImUzMD0iLCJmaWxlcyI6W119';

	test('should not display code editor', async ({ playgroundBlock }) => {
		await playgroundBlock.goto(playgroundOnlyUrl);

		// Verify the code editor is NOT visible
		const codeEditor = playgroundBlock.page.locator('.cm-editor');
		await expect(codeEditor).not.toBeVisible({ timeout: 10000 });
	});

	test('should display only WordPress Playground', async ({
		playgroundBlock,
		wordpress,
	}) => {
		await playgroundBlock.goto(playgroundOnlyUrl);

		// Verify WordPress admin is loaded (landing page is /wp-admin/)
		await expect(wordpress.locator('body')).toContainText('Dashboard', {
			timeout: 60000,
		});
	});

	test('should have full-width playground viewport', async ({
		playgroundBlock,
	}) => {
		await playgroundBlock.goto(playgroundOnlyUrl);

		// Verify the playground viewport takes up significant space
		// (no code editor taking up half the screen)
		const playgroundIframe =
			playgroundBlock.page.locator('.playground-iframe');
		await expect(playgroundIframe).toBeVisible();

		const boundingBox = await playgroundIframe.boundingBox();
		expect(boundingBox).not.toBeNull();
		if (boundingBox) {
			// The viewport should take most of the page width (at least 80% of viewport)
			const pageWidth = await playgroundBlock.page.evaluate(
				() => window.innerWidth
			);
			expect(boundingBox.width).toBeGreaterThan(pageWidth * 0.8);
		}
	});
});
