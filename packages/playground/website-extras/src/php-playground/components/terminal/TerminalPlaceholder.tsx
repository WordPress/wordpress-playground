import styles from './Terminal.module.css';
import { Spinner } from '../../../components/spinner';

export default function TerminalPlaceholder() {
	return (
		<div
			className={styles.placeholderContainer}
			aria-live="polite"
			aria-busy="true"
		>
			<div className={styles.placeholderContent}>
				<Spinner size={36} />
				<div className={styles.placeholderHeading}>
					Starting Playground…
				</div>
				<div className={styles.placeholderSubtext}>
					Terminal will be available shortly
				</div>
				<div className={styles.skeletonList} aria-hidden>
					<div className={styles.skeletonLine}></div>
					<div
						className={`${styles.skeletonLine} ${styles.skeletonLineShort}`}
					></div>
					<div className={styles.skeletonLine}></div>
				</div>
			</div>
		</div>
	);
}
