import { useState } from 'react';
import { TextControl } from '@wordpress/components';
import { Modal } from '../../modal';
import ModalButtons from '../../modal/modal-buttons';
import { parseGitHubTreeUrl } from '../../../lib/state/redux/git-directory-sources';

export interface MountGitDirectorySubmission {
	url: string;
	ref: string;
	path?: string;
}

/**
 * Prompts for a git repository to mount a plugin/theme directory from.
 * Host-agnostic by design — the repository can be on GitHub, GitLab, or any
 * other git remote reachable over HTTPS. The install location
 * (`wp-content/plugins` or `wp-content/themes`) and the mounted folder's
 * name are both inferred, not asked for here.
 */
export function MountGitDirectoryModal({
	kind,
	isBusy,
	error,
	onSubmit,
	onCancel,
}: {
	kind: 'plugin' | 'theme';
	isBusy: boolean;
	error: string | null;
	onSubmit: (submission: MountGitDirectorySubmission) => void;
	onCancel: () => void;
}) {
	const [url, setUrl] = useState('');
	const [ref, setRef] = useState('');
	const [path, setPath] = useState('');

	const trimmedUrl = url.trim();

	/**
	 * A pasted GitHub "tree" URL (e.g. from the branch dropdown) carries the
	 * ref inside the URL itself — split it out so the URL field is left
	 * with just the repository.
	 */
	const handleUrlChange = (value: string) => {
		const parsedTreeUrl = parseGitHubTreeUrl(value);
		if (parsedTreeUrl) {
			setUrl(parsedTreeUrl.url);
			setRef(parsedTreeUrl.ref);
			return;
		}
		setUrl(value);
	};

	const handleSubmit = () => {
		if (!trimmedUrl || isBusy) {
			return;
		}
		onSubmit({
			url: trimmedUrl,
			ref: ref.trim() || 'HEAD',
			path: path.trim() || undefined,
		});
	};

	return (
		<Modal title={`Mount ${kind} via git`} onRequestClose={onCancel} small>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
			>
				<TextControl
					__nextHasNoMarginBottom
					label="Repository URL"
					value={url}
					onChange={handleUrlChange}
					placeholder="github.com/owner/repo"
					autoFocus
					disabled={isBusy}
				/>
				<TextControl
					__nextHasNoMarginBottom
					label="Branch, tag, or commit"
					value={ref}
					onChange={(val: string) => setRef(val)}
					placeholder="HEAD"
					disabled={isBusy}
				/>
				<TextControl
					__nextHasNoMarginBottom
					label="Path within the repository (optional)"
					value={path}
					onChange={(val: string) => setPath(val)}
					placeholder="Leave empty to use the repository root"
					disabled={isBusy}
				/>
				{error ? <p role="alert">{error}</p> : null}
				<ModalButtons
					submitText={`Mount ${kind}`}
					areDisabled={!trimmedUrl || isBusy}
					areBusy={isBusy}
					onCancel={onCancel}
				/>
			</form>
		</Modal>
	);
}
