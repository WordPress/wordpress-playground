import React, { type ReactNode } from 'react';
import styles from './style.module.css';

export type BinaryFilePreviewProps = {
	filename: string;
	mimeType: string;
	dataUrl: string;
	downloadUrl?: string | null;
	showHeader?: boolean;
};

const determineMediaType = (mimeType: string) => {
	if (!mimeType) {
		return {
			isImage: false,
			isVideo: false,
			isAudio: false,
		};
	}

	const normalized = mimeType.toLowerCase();
	return {
		isImage: normalized.startsWith('image/'),
		isVideo: normalized.startsWith('video/'),
		isAudio: normalized.startsWith('audio/'),
	};
};

export function BinaryFilePreview({
	filename,
	mimeType,
	dataUrl,
	downloadUrl,
	showHeader = true,
}: BinaryFilePreviewProps) {
	const { isImage, isVideo, isAudio } = determineMediaType(mimeType);
	const shouldShowHeader = showHeader !== false;
	const hasDownload = Boolean(downloadUrl && filename);

	const renderDownloadLink = () =>
		hasDownload ? (
			<a
				className={styles['downloadLink']}
				href={downloadUrl!}
				download={filename}
			>
				Download
			</a>
		) : null;

	const renderPreview = (): ReactNode => {
		if (isImage) {
			return (
				<img
					className={styles['imagePreview']}
					src={dataUrl}
					alt={filename || 'Preview'}
				/>
			);
		}

		if (isVideo) {
			return (
				<video
					className={styles['videoPreview']}
					controls
					preload="metadata"
				>
					<source src={dataUrl} type={mimeType} />
					Your browser does not support the video tag.
				</video>
			);
		}

		if (isAudio) {
			return (
				<audio className={styles['audioPreview']} controls>
					<source src={dataUrl} type={mimeType} />
					Your browser does not support the audio tag.
				</audio>
			);
		}

		return (
			<div className={styles['unsupportedMessage']}>
				<p>Preview unavailable for this file type.</p>
				{hasDownload ? (
					<p>{renderDownloadLink()}</p>
				) : (
					<p>Download the file to inspect its contents.</p>
				)}
			</div>
		);
	};

	return (
		<div className={styles['container']}>
			{shouldShowHeader && (
				<div className={styles['header']}>
					<span className={styles['filename']} title={filename}>
						{filename}
					</span>
					{renderDownloadLink()}
				</div>
			)}
			<div className={styles['previewArea']}>{renderPreview()}</div>
			{!shouldShowHeader && hasDownload && (
				<div className={styles['actions']}>{renderDownloadLink()}</div>
			)}
		</div>
	);
}
