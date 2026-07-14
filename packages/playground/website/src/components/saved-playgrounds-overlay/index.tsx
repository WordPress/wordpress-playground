import { useState } from 'react';
import { Overlay, OverlayBody, OverlayHeader } from '../overlay';
import { SavedPlaygroundsPanel } from '../saved-playgrounds-panel';
import css from './style.module.css';

export type OverlayViewMode = 'main' | 'blueprints';

type Panel = 'playgrounds' | 'new';

interface SavedPlaygroundsOverlayProps {
	onClose: () => void;
	initialViewMode?: OverlayViewMode;
}

/**
 * Hosts the reusable Playgrounds and New Playground panels in the existing
 * full-screen overlay. The Dock can mount the same panels without this shell.
 */
export function SavedPlaygroundsOverlay({
	onClose,
	initialViewMode = 'main',
}: SavedPlaygroundsOverlayProps) {
	const [panel, setPanel] = useState<Panel>(
		initialViewMode === 'blueprints' ? 'new' : 'playgrounds'
	);
	const [isCloseBlocked, setIsCloseBlocked] = useState(false);
	const closeOverlay = () => {
		if (!isCloseBlocked) {
			onClose();
		}
	};

	return (
		<Overlay
			onClose={closeOverlay}
			className={css.overlay}
			contentClassName={css.content}
		>
			<OverlayHeader onClose={closeOverlay}>
				<div
					className={css.panelTabs}
					role="group"
					aria-label="Playground panels"
				>
					<button
						type="button"
						aria-pressed={panel === 'playgrounds'}
						className={css.panelTab}
						onClick={() => setPanel('playgrounds')}
						disabled={isCloseBlocked}
					>
						Playgrounds
					</button>
					<button
						type="button"
						aria-pressed={panel === 'new'}
						className={css.panelTab}
						onClick={() => setPanel('new')}
						disabled={isCloseBlocked}
					>
						New Playground
					</button>
				</div>
			</OverlayHeader>
			<OverlayBody className={css.body}>
				<SavedPlaygroundsPanel
					onClose={closeOverlay}
					panel={panel}
					onCloseBlockedChange={setIsCloseBlocked}
				/>
			</OverlayBody>
		</Overlay>
	);
}
