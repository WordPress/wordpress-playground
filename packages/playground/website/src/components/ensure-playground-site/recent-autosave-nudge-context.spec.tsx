import { renderToStaticMarkup } from 'react-dom/server';
import {
	RecentAutosaveNudgeProvider,
	useRecentAutosaveNudgeVisible,
} from './recent-autosave-nudge-context';

describe('RecentAutosaveNudgeContext', () => {
	it('defaults to hidden', () => {
		expect(renderToStaticMarkup(<Visibility />)).toBe('hidden');
	});

	it('exposes visible nudges to descendants', () => {
		expect(
			renderToStaticMarkup(
				<RecentAutosaveNudgeProvider visible>
					<Visibility />
				</RecentAutosaveNudgeProvider>
			)
		).toBe('visible');
	});
});

function Visibility() {
	return useRecentAutosaveNudgeVisible() ? 'visible' : 'hidden';
}
