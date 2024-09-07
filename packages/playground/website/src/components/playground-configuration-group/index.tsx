import { useSelector } from 'react-redux';
import { SyncLocalFilesButton } from './sync-local-files-button';
import React from 'react';
import { PlaygroundReduxState } from '../../lib/redux-store';

export default function PlaygroundConfigurationGroup() {
	const activeSite = useSelector(
		(state: PlaygroundReduxState) => state.activeSite!
	);
	return activeSite?.metadata?.storage === 'local-fs' ? (
		<SyncLocalFilesButton />
	) : null;
}
