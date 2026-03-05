import { type MouseEvent, useEffect } from 'react';
import clsx from 'clsx';

import styles from './Layout.module.css';

interface HelpModalProps {
	isOpen: boolean;
	onRequestClose: () => void;
}

export const HelpModal = ({ isOpen, onRequestClose }: HelpModalProps) => {
	const modalClassName = clsx(styles.modal, {
		[styles.modalVisible]: isOpen,
	});

	const handleOverlayClick = () => {
		if (isOpen) {
			onRequestClose();
		}
	};

	const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	};

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onRequestClose();
			}
		};
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	}, [isOpen, onRequestClose]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isOpen]);

	return (
		<div
			id="helpModal"
			className={modalClassName}
			role="dialog"
			aria-modal="true"
			aria-labelledby="helpModalTitle"
			aria-hidden={!isOpen}
			onClick={handleOverlayClick}
		>
			<div className={styles.modalContent} onClick={handleContentClick}>
				<div className={styles.modalHeader}>
					<h2 id="helpModalTitle" className={styles.modalTitle}>
						✨ WordPress PHP Playground ✨
					</h2>
					<button
						type="button"
						className={styles.closeButton}
						id="closeModal"
						aria-label="Close help"
						onClick={onRequestClose}
					>
						&times;
					</button>
				</div>
				<div className={styles.modalBody}>
					<p>
						Welcome to the <strong>WordPress PHP Playground</strong>
						! This interactive environment lets you experiment with
						PHP code alongside a full WordPress installation—all
						within your browser. No setup required!
					</p>
					<h3 className={styles.modalBodyHeading}>
						🚀 Getting Started
					</h3>
					<ul className={styles.modalBodyList}>
						<li>
							<strong>Write PHP:</strong> Use the editor on the
							left to enter PHP code.
						</li>
						<li>
							<strong>Run Instantly:</strong> Click <em>Run</em>{' '}
							or press <kbd>Ctrl/Cmd + S</kbd> to execute your
							code.
						</li>
						<li>
							<strong>See Output:</strong> Results appear in the
							preview panel on the right.
						</li>
					</ul>
					<h3 className={styles.modalBodyHeading}>🧰 Features</h3>
					<ul className={styles.modalBodyList}>
						<li>
							<strong>Full WordPress:</strong> A complete
							WordPress environment is available at{' '}
							<code className={styles.modalBodyCode}>
								/wordpress
							</code>
							.
						</li>
						<li>
							<strong>Version Control:</strong> Choose different
							WordPress and PHP versions on the top right.
						</li>
						<li>
							<strong>Shareable URLs:</strong> Your code and
							version choices are encoded in the address bar.
						</li>
					</ul>
					<h3 className={styles.modalBodyHeading}>📚 Learn More</h3>
					<ul className={styles.modalBodyList}>
						<li>
							<strong>Documentation:</strong>{' '}
							<a
								href="https://developer.wordpress.org/playground/"
								target="_blank"
								rel="noreferrer"
								className={styles.modalBodyLink}
							>
								developer.wordpress.org/playground
							</a>
						</li>
						<li>
							<strong>GitHub:</strong>{' '}
							<a
								href="https://github.com/WordPress/wordpress-playground"
								target="_blank"
								rel="noreferrer"
								className={styles.modalBodyLink}
							>
								github.com/WordPress/wordpress-playground
							</a>
						</li>
					</ul>
					<p>Have fun experimenting with WordPress and PHP! 💡</p>
				</div>
			</div>
		</div>
	);
};
