import { logger } from '@php-wasm/logger';
import type { OpfsFlushStatus } from '@php-wasm/web';
import type { PlaygroundClient } from '@wp-playground/remote';
import { selectClientInfoBySiteSlug, updateClientInfo } from './slice-clients';
import { isAutosavedSite, selectSiteBySlug } from './slice-sites';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';

export async function setOpfsFlushStatusCallback({
	playground,
	mountpoint,
	siteSlug,
	dispatch,
	getState,
}: {
	playground: PlaygroundClient;
	mountpoint: string;
	siteSlug: string;
	dispatch: PlaygroundDispatch;
	getState: () => PlaygroundReduxState;
}) {
	try {
		await playground.setOpfsFlushStatusCallback(
			mountpoint,
			(status: OpfsFlushStatus) => {
				const site = selectSiteBySlug(getState(), siteSlug);
				const operation =
					site && isAutosavedSite(site) ? 'autosave' : 'save';
				const currentSync = selectClientInfoBySiteSlug(
					getState(),
					siteSlug
				)?.opfsSync;

				if (status.status === 'flushing') {
					if (
						currentSync?.status === 'syncing' &&
						(currentSync.progress ||
							currentSync.operation === operation)
					) {
						return;
					}
					dispatch(
						updateClientInfo({
							siteSlug,
							changes: {
								opfsSync: {
									status: 'syncing',
									operation,
								},
							},
						})
					);
					return;
				}

				if (status.status === 'error') {
					if (
						currentSync?.status === 'error' &&
						currentSync.operation === operation
					) {
						return;
					}
					dispatch(
						updateClientInfo({
							siteSlug,
							changes: {
								opfsSync: {
									status: 'error',
									operation,
								},
							},
						})
					);
					return;
				}

				if (
					currentSync?.status !== 'syncing' ||
					currentSync.progress ||
					currentSync.operation !== operation
				) {
					return;
				}
				dispatch(
					updateClientInfo({
						siteSlug,
						changes: {
							opfsSync: undefined,
						},
					})
				);
			}
		);
	} catch (error) {
		logger.error('Error listening to OPFS flush status', error);
	}
}
