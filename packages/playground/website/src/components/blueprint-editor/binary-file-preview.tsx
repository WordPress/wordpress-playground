import styles from './binary-file-preview.module.css';

export type BinaryFilePreviewProps = {
	filename: string;
	mimeType: string;
	dataUrl: string;
};

export function BinaryFilePreview({
	filename,
	mimeType,
	dataUrl,
}: BinaryFilePreviewProps) {
	const isImage = mimeType.startsWith('image/');
	const isVideo = mimeType.startsWith('video/');
	const isAudio = mimeType.startsWith('audio/');

	return (
		<div className={styles.container}>
			<div className={styles.previewArea}>
				{isImage && (
					<img
						src={dataUrl}
						alt={filename}
						className={styles.imagePreview}
					/>
				)}
				{isVideo && (
					<video
						src={dataUrl}
						controls
						className={styles.videoPreview}
					>
						Your browser does not support the video tag.
					</video>
				)}
				{isAudio && (
					<audio
						src={dataUrl}
						controls
						className={styles.audioPreview}
					>
						Your browser does not support the audio tag.
					</audio>
				)}
			</div>
		</div>
	);
}
