import { useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import classNames from 'classnames';
import {
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	FlexItem,
	Button,
} from '@wordpress/components';
import { close, arrowLeft } from '@wordpress/icons';
import store from '../../lib/state/redux/store';
import css from './style.module.css';

function PlaygroundLogo() {
	return (
		<div className={css.logo}>
			<svg
				viewBox="0 0 124 124"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={css.logoIcon}
			>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M14.755 45.1665C12.0512 48.8962 10.6245 53.4789 10.3951 58.5153C10.358 59.3301 10.3522 60.1566 10.3774 60.9934C10.7191 72.3238 16.7432 85.5209 27.6103 96.388C44.2413 113.019 66.3294 118.307 78.8323 109.243C73.5732 108.004 68.2526 106.073 63.0136 103.496C61.6689 103.437 60.222 103.262 58.6713 102.952C56.0196 102.421 53.2158 101.511 50.3594 100.216C50.3593 100.216 50.3592 100.215 50.359 100.215C45.1354 97.8469 39.7361 94.1934 34.7704 89.2277C29.8052 84.2625 26.1519 78.8637 23.784 73.6406C23.7838 73.6405 23.7836 73.6405 23.7834 73.6404C22.4884 70.7839 21.5779 67.9798 21.0476 65.3279C20.7375 63.7776 20.5621 62.3309 20.5032 60.9865C17.9263 55.7471 15.9944 50.426 14.755 45.1665ZM4.33861 76.7002C4.71713 76.3217 5.11425 75.9686 5.52862 75.6407C6.7468 79.1965 8.35436 82.7444 10.3249 86.214C10.06 87.3833 10.0041 88.9848 10.4335 91.1319C11.2858 95.3936 13.9437 100.626 18.659 105.341C23.3743 110.056 28.6064 112.714 32.8681 113.567C35.0158 113.996 36.6176 113.94 37.787 113.675C41.2566 115.645 44.8043 117.252 48.36 118.47C48.0319 118.885 47.6786 119.283 47.2998 119.661C39.3909 127.57 23.3622 124.365 11.4988 112.501C-0.364596 100.638 -3.57033 84.6091 4.33861 76.7002ZM43.7198 80.2786C67.4466 104.005 99.5039 110.417 115.322 94.599C121.041 88.8798 123.854 81.0375 123.994 72.2337C124.239 56.6885 116.149 38.1454 101.001 22.9976C77.2746 -0.729192 45.2173 -7.14065 29.3994 8.67722C23.6725 14.4041 20.8595 22.2597 20.7271 31.078C20.4941 46.6158 28.5836 65.1423 43.7198 80.2786ZM77.1341 84.4888C77.5747 86.6917 77.7433 88.6853 77.6924 90.4738C68.7821 87.3724 59.3392 81.5782 50.88 73.119C42.4208 64.6598 36.6267 55.2171 33.5253 46.3068C35.3138 46.2559 37.3074 46.4245 39.5104 46.8651C47.0115 48.3653 55.7301 52.9069 63.4112 60.588C71.0923 68.2691 75.6339 76.9877 77.1341 84.4888ZM36.5596 15.8374C32.2725 20.1245 29.985 27.0976 31.1373 36.3235C43.2662 35.1444 58.3841 41.2404 70.5714 53.4278C82.7587 65.6151 88.8548 80.7329 87.6757 92.8617C96.9016 94.014 103.875 91.7265 108.162 87.4394C112.932 82.6694 115.226 74.5742 113.061 63.7503C110.913 53.0099 104.488 40.8048 93.8412 30.1578C83.1942 19.5108 70.9891 13.0857 60.2487 10.9376C49.4248 8.7728 41.3296 11.0674 36.5596 15.8374Z"
					fill="#e5e6e6"
				/>
			</svg>
			<span className={css.logoText}>Playground</span>
		</div>
	);
}

interface OverlayProps {
	children: ReactNode;
	onClose: () => void;
	className?: string;
}

export function Overlay({ children, onClose, className }: OverlayProps) {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				const currentActiveModal = store.getState().ui.activeModal;
				if (currentActiveModal) {
					return;
				}
				onClose();
			}
		},
		[onClose]
	);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown, true);
		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [handleKeyDown]);

	return (
		<div className={classNames(css.overlay, className)}>
			<VStack className={css.fullscreenContent} spacing={0}>
				{children}
			</VStack>
		</div>
	);
}

interface OverlayHeaderProps {
	children?: ReactNode;
	onClose: () => void;
	onBack?: () => void;
	title?: string;
	showLogo?: boolean;
}

export function OverlayHeader({
	children,
	onClose,
	onBack,
	title,
	showLogo = true,
}: OverlayHeaderProps) {
	return (
		<HStack
			className={css.header}
			alignment="center"
			justify="space-between"
		>
			{onBack ? (
				<Button
					icon={arrowLeft}
					label="Back"
					onClick={onBack}
					className={css.backButton}
				/>
			) : (
				<FlexItem className={css.headerSpacer} />
			)}
			{children || (
				<>
					{showLogo && <PlaygroundLogo />}
					{title && <h1 className={css.headerTitle}>{title}</h1>}
				</>
			)}
			<Button
				icon={close}
				label="Close"
				onClick={onClose}
				className={css.closeButton}
			/>
		</HStack>
	);
}

interface OverlayBodyProps {
	children: ReactNode;
	className?: string;
}

export function OverlayBody({ children, className }: OverlayBodyProps) {
	return <div className={classNames(css.body, className)}>{children}</div>;
}

interface OverlaySectionProps {
	children: ReactNode;
	title?: string;
	description?: string;
	className?: string;
}

export function OverlaySection({
	children,
	title,
	description,
	className,
}: OverlaySectionProps) {
	return (
		<section className={classNames(css.section, className)}>
			{title && <h2 className={css.sectionTitle}>{title}</h2>}
			{description && (
				<p className={css.sectionDescription}>{description}</p>
			)}
			{children}
		</section>
	);
}

export { css as overlayStyles };
