import type {
	Dispatch,
	MutableRefObject,
	SetStateAction,
} from 'react';
import type { AsyncWritableFilesystem } from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import { SaveState } from './save-state';

export function getSaveStatusLabel(
	saveState: SaveState,
	saveError: string | null
) {
	switch (saveState) {
		case SaveState.PENDING:
		case SaveState.SAVING:
			return 'Saving…';
		case SaveState.SAVED:
			return 'Saved';
		case SaveState.ERROR:
			return saveError ?? 'Save failed';
		default:
			return '';
	}
}

export function getSaveStatusClassName(
	saveState: SaveState,
	styleSheet: {
		saveStatusPending?: string;
		saveStatusSaving?: string;
		saveStatusError?: string;
	}
) {
	switch (saveState) {
		case SaveState.PENDING:
			return styleSheet.saveStatusPending;
		case SaveState.SAVING:
			return styleSheet.saveStatusSaving;
		case SaveState.ERROR:
			return styleSheet.saveStatusError;
		default:
			return undefined;
	}
}

export async function flushPendingSave(
	filesystem: AsyncWritableFilesystem | null,
	{
		saveTimeoutRef,
		currentPathRef,
		codeRef,
		setSaveState,
		setSaveError,
	}: {
		saveTimeoutRef: MutableRefObject<number | null>;
		currentPathRef: MutableRefObject<string | null>;
		codeRef: MutableRefObject<string>;
		setSaveState: Dispatch<SetStateAction<SaveState>>;
		setSaveError: Dispatch<SetStateAction<string | null>>;
	}
) {
	if (saveTimeoutRef.current === null) {
		return;
	}
	if (!filesystem || !currentPathRef.current) {
		window.clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = null;
		return;
	}
	window.clearTimeout(saveTimeoutRef.current);
	saveTimeoutRef.current = null;
	setSaveState(SaveState.SAVING);
	try {
		await filesystem.writeFile(currentPathRef.current, codeRef.current);
		setSaveState(SaveState.SAVED);
		setSaveError(null);
	} catch (error) {
		logger.error('Failed to save file', error);
		setSaveState(SaveState.ERROR);
		setSaveError('Could not save changes. Try again.');
		throw error;
	}
}
