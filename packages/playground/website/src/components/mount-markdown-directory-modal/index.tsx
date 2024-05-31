// <reference types="@types/wicg-file-system-access" />
import css from './style.module.css';
import Modal from '../modal';
import { usePlaygroundContext } from '../../playground-context';
import { Button } from '@wordpress/components';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as pleaseLoadTypes from 'wicg-file-system-access';

export const localStorageKey = 'playground-start-error-dont-show-again';

export function MountMarkdownDirectoryModal() {
	const { setActiveModal, playground } = usePlaygroundContext();

	function handleCloseWhenIDontWantALocalDirectory() {
		// Push state without ?modal=mount-markdown-directory
		const urlWithoutModal = new URL(window.location.href);
		urlWithoutModal.searchParams.delete('modal');

		window.history.pushState({}, '', urlWithoutModal.toString());
		handleClose();
	}

	function handleClose() {
		setActiveModal(false);
	}

	async function loadMarkdownDirectory(e: React.MouseEvent) {
		e.preventDefault();

		const dirHandle = await showDirectoryPicker();

		// await playground.bindOpfs(dirHandle, (progress) => {
		// 	setMountProgress(progress);
		// });
		console.log(dirHandle);

		// handleClose();
	}

	return (
		<Modal
			isOpen={true}
			onRequestClose={handleCloseWhenIDontWantALocalDirectory}
		>
			<header>
				<h2>Markdown editor</h2>
			</header>

			<main className={css.logModalMain}>
				{/* @TODO Don't do a wall of text. Do good UX instead. */}
				<p>
					This is an online markdown editor. Load your Markdown files
					from the disk in one of the following ways:
				</p>
				<ul>
					<li>Use the directory picker below</li>
					<li>
						Use the file picker below
						{/* @TODO could make both the same */}
					</li>
					<li>
						Drag & drop files from the disk
						{/* @TODO If we do that, it won't work after closing this modal */}
					</li>
				</ul>
				<p>
					... or close this modal and paste the content of the file
					into the post editor.
				</p>
				<footer className={css.errorReportModalFooter}>
					<Button variant="primary" onClick={loadMarkdownDirectory}>
						Load a Markdown directory
					</Button>
					<Button onClick={handleCloseWhenIDontWantALocalDirectory}>
						Cancel
					</Button>
				</footer>
			</main>
		</Modal>
	);
}
