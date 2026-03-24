import React, { useState } from 'react';
import { TextControl } from '@wordpress/components';
import { useAppDispatch } from '../../lib/state/redux/store';
import {
	setActiveModal,
	setSiteManagerOpen,
} from '../../lib/state/redux/slice-ui';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';

export function BlueprintUrlModal() {
	const dispatch = useAppDispatch();
	const [url, setUrl] = useState<string>('');

	const closeModal = () => dispatch(setActiveModal(null));

	const handleSubmit = () => {
		const trimmed = url.trim();
		if (!trimmed) {
			return;
		}
		dispatch(setSiteManagerOpen(false));
		closeModal();
		redirectTo(
			PlaygroundRoute.newTemporarySite({
				query: {
					'blueprint-url': trimmed,
				},
			})
		);
	};

	return (
		<Modal
			title="Run Blueprint from URL"
			contentLabel='This is a dialog window which overlays the main content of the page. The modal begins with a heading 2 called "Run Blueprint from URL". Pressing the Close button will close the modal and bring you back to where you were on the page.'
			onRequestClose={closeModal}
			small
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
			>
				<TextControl
					__nextHasNoMarginBottom
					label="Blueprint URL"
					value={url}
					onChange={(val: string) => setUrl(val)}
					placeholder="https://example.com/blueprint.json"
					type="url"
					autoFocus
				/>
				<ModalButtons
					submitText="Run Blueprint"
					areDisabled={!url.trim()}
					onCancel={closeModal}
				/>
			</form>
		</Modal>
	);
}
