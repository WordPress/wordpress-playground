import React from 'react';
import { Dropdown, Icon } from '@wordpress/components';
import { backup } from '@wordpress/icons';
import Button from '../button';
import { useAppSelector, useActiveSite } from '../../lib/state/redux/store';
import { selectAllSites } from '../../lib/state/redux/slice-sites';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';
import css from './recent-sites-dropdown.module.css';

const MAX_RECENT_SITES = 8;

function relativeTimeString(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) {
		return 'just now';
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function RecentSitesDropdown() {
	const allSites = useAppSelector(selectAllSites);
	const activeSite = useActiveSite();

	const recentSites = allSites
		.filter((s) => s.metadata.storage !== 'none')
		.sort(
			(a, b) =>
				(b.metadata.whenCreated || 0) - (a.metadata.whenCreated || 0)
		)
		.slice(0, MAX_RECENT_SITES);

	if (recentSites.length === 0) {
		return null;
	}

	return (
		<Dropdown
			popoverProps={{ placement: 'bottom-end' }}
			renderToggle={({ isOpen, onToggle }) => (
				<Button
					variant="browser-chrome"
					aria-label="Recent Playgrounds"
					onClick={onToggle}
					aria-expanded={isOpen}
					style={{
						fill: '#FFF',
						alignItems: 'center',
						display: 'flex',
					}}
				>
					<Icon icon={backup} size={20} />
				</Button>
			)}
			renderContent={({ onClose }) => (
				<div className={css.dropdownContent}>
					<h3 className={css.dropdownTitle}>Recent Playgrounds</h3>
					<ul className={css.siteList}>
						{recentSites.map((site) => (
							<li key={site.slug}>
								<button
									type="button"
									className={`${css.siteItem} ${
										activeSite?.slug === site.slug
											? css.active
											: ''
									}`}
									onClick={() => {
										redirectTo(
											PlaygroundRoute.site(site)
										);
										onClose();
									}}
								>
									<span className={css.siteName}>
										{site.metadata.name}
									</span>
									{site.metadata.whenCreated && (
										<span className={css.siteDate}>
											{relativeTimeString(
												site.metadata.whenCreated
											)}
										</span>
									)}
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		/>
	);
}
