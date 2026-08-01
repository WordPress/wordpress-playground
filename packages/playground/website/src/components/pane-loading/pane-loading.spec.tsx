import { renderToStaticMarkup } from 'react-dom/server';
import { PaneLoading, PlaygroundBootNotice } from './index';

describe('PaneLoading', () => {
	it('announces the loading message politely', () => {
		const markup = renderToStaticMarkup(
			<PaneLoading message="Loading the file browser…" />
		);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('aria-live="polite"');
		expect(markup).toContain('Loading the file browser…');
	});
});

describe('PlaygroundBootNotice', () => {
	it('keeps the boot message visible while shown', () => {
		const markup = renderToStaticMarkup(
			<PlaygroundBootNotice
				show
				message="Database tools will be ready in a moment."
			/>
		);

		expect(markup).toContain('role="status"');
		expect(markup).not.toContain('aria-hidden="true"');
		expect(markup).toContain('Database tools will be ready in a moment.');
	});

	it('marks the collapsible notice hidden without unmounting it', () => {
		const markup = renderToStaticMarkup(
			<PlaygroundBootNotice
				show={false}
				message="Database tools will be ready in a moment."
				gap="20px"
			/>
		);

		expect(markup).toContain('aria-hidden="true"');
		expect(markup).toContain('--boot-gap:20px');
		expect(markup).toContain('Database tools will be ready in a moment.');
	});
});
