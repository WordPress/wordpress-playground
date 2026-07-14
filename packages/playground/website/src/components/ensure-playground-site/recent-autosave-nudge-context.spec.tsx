import { renderToStaticMarkup } from 'react-dom/server';
import {
	RecentAutosaveNudgeContext,
	useRecentAutosaveNudgeVisible,
} from './recent-autosave-nudge-context';

describe('RecentAutosaveNudgeContext', () => {
	it('defaults to hidden', () => {
		expect(renderToStaticMarkup(<Visibility />)).toBe('hidden');
	});

	it('exposes visible nudges to descendants', () => {
		expect(
			renderToStaticMarkup(
				<RecentAutosaveNudgeContext.Provider value>
					<Visibility />
				</RecentAutosaveNudgeContext.Provider>
			)
		).toBe('visible');
	});
});

function Visibility() {
	return useRecentAutosaveNudgeVisible() ? 'visible' : 'hidden';
}
