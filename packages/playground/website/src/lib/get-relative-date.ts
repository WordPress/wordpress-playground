import { __ } from '@wordpress/i18n';
import { getActiveLanguageTag } from './i18n';

export function getRelativeDate(inputDate: Date): string {
	const formatter = new Intl.RelativeTimeFormat(getActiveLanguageTag(), {
		style: 'long',
	});

	const now = new Date();
	const diffInSeconds = Math.floor(
		(inputDate.getTime() - now.getTime()) / 1000
	);

	const intervals = [
		{ unit: 'year', seconds: 31536000 },
		{ unit: 'month', seconds: 2592000 },
		{ unit: 'day', seconds: 86400 },
		{ unit: 'hour', seconds: 3600 },
		{ unit: 'minute', seconds: 60 },
		{ unit: 'second', seconds: 1 },
	] as const;

	for (const interval of intervals) {
		const value = Math.floor(diffInSeconds / interval.seconds);
		if (![1, -1, 0].includes(value)) {
			if (value < 60 && interval.unit === 'second') {
				return __('a moment ago', 'playground-website');
			}
			return formatter.format(value, interval.unit);
		}
	}

	return __('right now', 'playground-website');
}
