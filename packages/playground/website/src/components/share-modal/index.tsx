import { useState, useEffect, useCallback } from 'react';
import { Button, TextControl, Notice } from '@wordpress/components';
import { copy, check } from '@wordpress/icons';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { selectClientInfoBySiteSlug } from '../../lib/state/redux/slice-clients';
import {
	startSharing,
	stopSharing,
	getSharingStatus,
	subscribeToSharingStatus,
	type SharingStatus,
} from '../../lib/sharing-service';

type ShareState = 'idle' | 'connecting' | 'sharing' | 'error';

export function ShareModal() {
	const dispatch = useAppDispatch();
	const [shareState, setShareState] = useState<ShareState>('idle');
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const clientInfo = useAppSelector((state) =>
		state.ui.activeSite?.slug
			? selectClientInfoBySiteSlug(state, state.ui.activeSite.slug)
			: undefined
	);
	const playground = clientInfo?.client;

	const closeModal = useCallback(() => {
		dispatch(setActiveModal(null));
	}, [dispatch]);

	// Sync state with sharing service
	const updateFromSharingStatus = useCallback((status: SharingStatus) => {
		setShareUrl(status.shareUrl);

		if (!status.isActive) {
			setShareState('idle');
		} else {
			switch (status.status) {
				case 'connecting':
					setShareState('connecting');
					break;
				case 'connected':
					setShareState('sharing');
					break;
				case 'disconnected':
					setShareState('idle');
					break;
				case 'error':
					setShareState('error');
					break;
			}
		}
	}, []);

	// Initialize state from sharing service and subscribe to updates
	useEffect(() => {
		// Initialize from current state
		updateFromSharingStatus(getSharingStatus());

		// Subscribe to changes
		const unsubscribe = subscribeToSharingStatus(updateFromSharingStatus);
		return unsubscribe;
	}, [updateFromSharingStatus]);

	const handleStartSharing = async () => {
		if (!playground) {
			setError('Playground is not ready');
			return;
		}

		setShareState('connecting');
		setError(null);

		try {
			const url = await startSharing(playground);
			setShareUrl(url);
			setShareState('sharing');
		} catch (err) {
			setError((err as Error).message);
			setShareState('error');
		}
	};

	const handleStopSharing = async () => {
		await stopSharing();
		setShareUrl(null);
		setShareState('idle');
		setError(null);
	};

	const copyToClipboard = async () => {
		if (shareUrl) {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleRequestClose = () => {
		// Allow closing the modal even while sharing - sharing continues in background
		if (shareState !== 'connecting') {
			closeModal();
		}
	};

	return (
		<Modal
			title="Share Playground"
			contentLabel="Share Playground"
			onRequestClose={handleRequestClose}
			isDismissible={shareState !== 'connecting'}
			small
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
				{shareState === 'idle' && (
					<>
						<p style={{ margin: 0, color: '#1e1e1e' }}>
							Share your Playground with others in real-time.
							They'll be able to view and interact with your
							WordPress site through their browser.
						</p>
						<Notice status="warning" isDismissible={false}>
							Your Playground will be accessible to anyone with
							the share link while sharing is active.
						</Notice>
					</>
				)}

				{shareState === 'connecting' && (
					<p style={{ margin: 0, color: '#1e1e1e' }}>
						Setting up sharing session...
					</p>
				)}

				{shareState === 'sharing' && shareUrl && (
					<>
						<Notice status="success" isDismissible={false}>
							Your Playground is being shared! Copy the link below
							to share it with others.
						</Notice>
						<div
							style={{
								display: 'flex',
								gap: 8,
								alignItems: 'flex-end',
							}}
						>
							<TextControl
								label="Share URL"
								value={shareUrl}
								readOnly
								onChange={() => {}}
								style={{ flexGrow: 1, marginBottom: 0 }}
								onClick={(e) =>
									(e.target as HTMLInputElement).select()
								}
							/>
							<Button
								variant="secondary"
								icon={copied ? check : copy}
								onClick={copyToClipboard}
								label={copied ? 'Copied!' : 'Copy to clipboard'}
							>
								{copied ? 'Copied!' : 'Copy'}
							</Button>
						</div>
						<p
							style={{
								margin: 0,
								color: '#757575',
								fontSize: 12,
							}}
						>
							You can close this modal - sharing will continue in
							the background. Look for the sharing indicator in the
							toolbar.
						</p>
					</>
				)}

				{shareState === 'error' && error && (
					<Notice status="error" isDismissible={false}>
						{error}
					</Notice>
				)}

				<div
					style={{
						display: 'flex',
						justifyContent: 'flex-end',
						gap: 8,
					}}
				>
					{shareState === 'idle' && (
						<ModalButtons
							submitText="Start Sharing"
							onCancel={handleRequestClose}
							areDisabled={!playground}
							areBusy={false}
							style={{ marginTop: 0 }}
							onSubmit={handleStartSharing}
						/>
					)}

					{shareState === 'connecting' && (
						<Button variant="secondary" disabled>
							Connecting...
						</Button>
					)}

					{shareState === 'sharing' && (
						<>
							<Button variant="secondary" onClick={closeModal}>
								Keep in Background
							</Button>
							<Button
								variant="primary"
								isDestructive
								onClick={handleStopSharing}
							>
								Stop Sharing
							</Button>
						</>
					)}

					{shareState === 'error' && (
						<ModalButtons
							submitText="Try Again"
							onCancel={handleRequestClose}
							areDisabled={!playground}
							areBusy={false}
							style={{ marginTop: 0 }}
							onSubmit={handleStartSharing}
						/>
					)}
				</div>
			</div>
		</Modal>
	);
}
