import { Button } from '@wordpress/components';
import css from './style.module.css';
import { SitePersistButton } from '../site-persist-button';
import classNames from 'classnames';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { useActiveSite } from '../../../lib/state/redux/store';
import { isSiteSavingDisabled } from '../../../lib/state/url/router';

/**
 * A calm, borderless note for unsaved Playgrounds — a quiet line of muted copy
 * plus a Save action, rather than a boxed warning callout. Save opens the save
 * flow (browser or a local directory).
 */
export function TemporarySiteNotice({ className }: { className?: string }) {
	const site = useActiveSite()!;
	const playground = usePlaygroundClient(site.slug);
	if (isSiteSavingDisabled()) {
		return null;
	}
	return (
		<div className={classNames(css.notice, className)}>
			<p className={css.text}>
				Changes are lost on refresh — save to keep this Playground.
			</p>
			<SitePersistButton siteSlug={site.slug}>
				<Button
					variant="primary"
					disabled={!playground}
					aria-label="Save site locally"
				>
					Save
				</Button>
			</SitePersistButton>
		</div>
	);
}
