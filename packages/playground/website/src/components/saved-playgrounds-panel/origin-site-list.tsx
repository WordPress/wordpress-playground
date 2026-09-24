import { useEffect, useState } from 'react';
import { WordPressIcon } from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import {
	isSiteOrigin,
	updateOriginCatalogue,
} from '../../lib/origin-isolation';
import type { OriginSite } from '../../lib/origin-isolation';
import { TruncatedText } from '../truncated-text';
import css from './style.module.css';

/** Other sites are links, not local SiteInfo objects that could enter OPFS operations. */
export function OriginSiteList() {
	const [sites, setSites] = useState<OriginSite[]>([]);
	const [error, setError] = useState(false);
	useEffect(() => {
		if (!isSiteOrigin(window.location.origin)) return;
		let disposed = false;
		const refresh = () => {
			void updateOriginCatalogue()
				.then((result) => {
					if (!disposed) {
						setSites(
							result.filter(
								(site) => site.origin !== window.location.origin
							)
						);
						setError(false);
					}
				})
				.catch((error) => {
					logger.error('Could not load the Playground list', error);
					if (!disposed) setError(true);
				});
		};
		refresh();
		window.addEventListener('focus', refresh);
		window.addEventListener('playground-catalogue-updated', refresh);
		return () => {
			disposed = true;
			window.removeEventListener('focus', refresh);
			window.removeEventListener('playground-catalogue-updated', refresh);
		};
	}, []);
	if (error)
		return <p>Could not load other Playgrounds. Reload to try again.</p>;
	if (!sites.length) return null;
	return (
		<div className={css.siteGroup}>
			<h3 className={css.siteGroupTitle}>Other Playgrounds</h3>
			<div className={css.sitesList}>
				{sites.map((site) => (
					<div key={site.origin} className={css.siteRow}>
						<a
							className={css.siteRowContent}
							href={site.origin}
							aria-label={`Open ${site.name}`}
						>
							<div
								className={`${css.siteRowPreview} ${css.siteRowPreviewFallback}`}
							>
								<div className={css.siteRowLogo}>
									<WordPressIcon />
								</div>
							</div>
							<div className={css.siteRowInfo}>
								<TruncatedText className={css.siteRowName}>
									{site.name}
								</TruncatedText>
								<span className={css.siteRowDate}>
									{site.persistence === 'autosave'
										? 'Autosaved'
										: 'Saved'}
								</span>
							</div>
						</a>
					</div>
				))}
			</div>
		</div>
	);
}
