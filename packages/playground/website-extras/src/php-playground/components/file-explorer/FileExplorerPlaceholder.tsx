import clsx from 'clsx';
import styles from './FileExplorer.module.css';

export default function FileExplorerPlaceholder() {
	return (
		<div className={styles.fileExplorerContainer}>
			<div className={styles.fileExplorerHeader}>
				<span className={styles.fileExplorerTitle}>Files</span>
				<div className={styles.fileExplorerActions}>
					<button className={styles.fileExplorerButton} disabled>
						New File
					</button>
					<button className={styles.fileExplorerButton} disabled>
						New Folder
					</button>
				</div>
			</div>
			<div className={styles.fileExplorerTree}>
				<div className={styles.placeholderContainer} aria-live="polite">
					<div className={styles.placeholderContent}>
						<div className={styles.placeholderHeading}>
							Preparing Playground…
						</div>
						<div className={styles.placeholderSubtext}>
							File explorer will be ready shortly
						</div>
						<div className={styles.skeletonList} aria-hidden="true">
							<div className={styles.skeletonLine}></div>
							<div className={styles.skeletonLine}></div>
							<div
								className={clsx(
									styles.skeletonLine,
									styles.skeletonLineShort
								)}
							></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
