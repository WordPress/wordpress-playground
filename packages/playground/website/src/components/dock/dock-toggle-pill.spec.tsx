import { renderToStaticMarkup } from 'react-dom/server';
import { DockTogglePill } from './dock-toggle-pill';

describe('DockTogglePill', () => {
	it('labels the collapsed and full-width actions', () => {
		const markup = renderToStaticMarkup(
			<DockTogglePill
				isCollapsed
				isFullWidth
				onToggleCollapsed={() => {}}
				onToggleFullWidth={() => {}}
			/>
		);

		expect(markup).toContain('aria-label="Show tools"');
		expect(markup).toContain('aria-expanded="false"');
		expect(markup).toContain('title="Show tools"');
		expect(markup).toContain('aria-label="Exit full width"');
		expect(markup).toContain('aria-pressed="true"');
		expect(markup).toContain('title="Exit full width"');
	});

	it('labels the expanded and floating actions', () => {
		const markup = renderToStaticMarkup(
			<DockTogglePill
				isCollapsed={false}
				isFullWidth={false}
				onToggleCollapsed={() => {}}
				onToggleFullWidth={() => {}}
			/>
		);

		expect(markup).toContain('aria-label="Hide tools"');
		expect(markup).toContain('aria-expanded="true"');
		expect(markup).toContain('aria-label="Full width"');
		expect(markup).toContain('aria-pressed="false"');
	});
});
