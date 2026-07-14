import { renderToStaticMarkup } from 'react-dom/server';
import { DockCornerLauncher } from './dock-corner-launcher';

describe('DockCornerLauncher', () => {
	it('renders the minimized dock launcher with its logo content', () => {
		const markup = renderToStaticMarkup(
			<DockCornerLauncher side="left">
				<span>WP</span>
			</DockCornerLauncher>
		);

		expect(markup).toContain('aria-label="Show Playground tools"');
		expect(markup).toContain(
			'title="Drag out or click to show Playground tools"'
		);
		expect(markup).toContain('WP');
	});

	it('disables clicks while the dock is folding into the corner', () => {
		const markup = renderToStaticMarkup(
			<DockCornerLauncher side="right" isFolding>
				<span>WP</span>
			</DockCornerLauncher>
		);

		expect(markup).toContain('disabled=""');
	});
});
