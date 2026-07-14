import { renderToStaticMarkup } from 'react-dom/server';
import { DockPane } from './dock-pane';

describe('DockPane', () => {
	it('renders a dialog shell with heading, description, and body', () => {
		const markup = renderToStaticMarkup(
			<DockPane
				title="Files"
				description="Browse and edit the active Playground filesystem."
			>
				<p>Pane content</p>
			</DockPane>
		);

		expect(markup).toContain('role="dialog"');
		expect(markup).toContain('aria-label="Files pane"');
		expect(markup).toContain('<h2>Files</h2>');
		expect(markup).toContain(
			'Browse and edit the active Playground filesystem.'
		);
		expect(markup).toContain('Pane content');
	});

	it('can render pane content without the shared header', () => {
		const markup = renderToStaticMarkup(
			<DockPane title="Blueprint" showHeader={false}>
				<p>Editor content</p>
			</DockPane>
		);

		expect(markup).not.toContain('<h2>Blueprint</h2>');
		expect(markup).toContain('Editor content');
	});

	it('can replace the description with richer header content', () => {
		const markup = renderToStaticMarkup(
			<DockPane
				title="Blueprint"
				description="Plain description"
				headerSubtitle={<a href="/docs">Blueprint documentation</a>}
			>
				<p>Editor content</p>
			</DockPane>
		);

		expect(markup).toContain('Blueprint documentation');
		expect(markup).not.toContain('Plain description');
	});

	it('renders a disabled close button when pane closing is blocked', () => {
		const markup = renderToStaticMarkup(
			<DockPane
				title="Export"
				onClose={() => {}}
				closeDisabled
				closeTitle="Wait for the current action to finish"
			>
				<p>Export content</p>
			</DockPane>
		);

		expect(markup).toContain('aria-label="Close"');
		expect(markup).toContain('aria-describedby=');
		expect(markup).toContain(
			'title="Wait for the current action to finish"'
		);
		expect(markup).toContain('Wait for the current action to finish');
		expect(markup).toContain('disabled=""');
	});
});
