import { renderToStaticMarkup } from 'react-dom/server';
import { DockItemButton } from './dock-item-button';
import { DockDatabaseIcon } from './icons';

describe('DockItemButton', () => {
	it('renders a stable accessible name and pressed state', () => {
		const markup = renderToStaticMarkup(
			<DockItemButton
				label="Database"
				ariaLabel="Database"
				icon={<DockDatabaseIcon />}
				isActive
				dataCy="database-tool"
			/>
		);

		expect(markup).toContain('aria-label="Database"');
		expect(markup).toContain('aria-pressed="true"');
		expect(markup).toContain('data-cy="database-tool"');
		expect(markup).toContain('Database');
	});

	it('announces notification dots without exposing decorative dots', () => {
		const markup = renderToStaticMarkup(
			<DockItemButton
				label="Blueprint"
				ariaLabel="Current Blueprint"
				icon={<span>Blueprint icon</span>}
				hasNotification
				notificationAriaSuffix="recent autosave available"
			/>
		);
		const hiddenMarkerCount = countMatches(markup, 'aria-hidden="true"');

		expect(markup).toContain(
			'aria-label="Current Blueprint — recent autosave available"'
		);
		expect(hiddenMarkerCount).toBe(2);
	});

	it('can disable unavailable actions', () => {
		const markup = renderToStaticMarkup(
			<DockItemButton
				label="Database"
				ariaLabel="Database"
				icon={<DockDatabaseIcon />}
				disabled
			/>
		);

		expect(markup).toMatch(/<button\b[^>]*\sdisabled(?:="")?(?=\s|>)/);
	});
});

function countMatches(value: string, substring: string) {
	return value.split(substring).length - 1;
}
