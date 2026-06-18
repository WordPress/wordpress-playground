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
import playgroundLogoSvg from '../../playground-logo.svg?raw';

export function PlaygroundLogo() {
	return (
		<div className={css.logo}>
			{/* eslint-disable-next-line react/no-danger */}
			<span
				className={css.logoIcon}
				dangerouslySetInnerHTML={{ __html: playgroundLogoSvg }}
			/>
			<span className={css.logoText}>Playground</span>
		</div>
	);
}

interface OverlayProps {
	children: ReactNode;
	onClose: () => void;
	className?: string;
	contentClassName?: string;
}

export function Overlay({
	children,
	onClose,
	className,
	contentClassName,
}: OverlayProps) {
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
			<VStack
				className={classNames(css.fullscreenContent, contentClassName)}
				spacing={0}
			>
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
