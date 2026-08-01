import {
	Button,
	Dropdown,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { useEffect, useRef, useState } from 'react';
import {
	MAX_AUTOSAVED_SITES,
	type SitePersistence,
} from '../../../lib/state/redux/site-lifecycle';
import type { SiteFormData } from './unconnected-site-settings-form';
import type { SiteSettingsFormFooterContext } from './unconnected-site-settings-form';
import { getFreshPlaygroundReason } from './site-settings-actions';
import css from './style.module.css';

type SettingsAction = 'apply' | 'fresh';

export function SiteSettingsActionFooter({
	siteName,
	sitePersistence,
	values,
	defaultValues,
	submit,
	onApply,
	onCreateFresh,
	isPending,
	error,
}: SiteSettingsFormFooterContext & {
	siteName: string;
	sitePersistence: SitePersistence;
	onApply: (data: SiteFormData) => void | Promise<void>;
	onCreateFresh: (data: SiteFormData) => void | Promise<void>;
	isPending: boolean;
	error?: string;
}) {
	const freshPlaygroundReason = getFreshPlaygroundReason(
		values,
		defaultValues
	);
	const applyUnavailableReason = freshPlaygroundReason;
	const canApplyToCurrent = !applyUnavailableReason;
	const [selectedAction, setSelectedAction] =
		useState<SettingsAction>('apply');
	const forcedFreshActionRef = useRef(false);
	const primaryAction =
		selectedAction === 'apply' && canApplyToCurrent ? 'apply' : 'fresh';

	useEffect(() => {
		if (!canApplyToCurrent) {
			if (selectedAction === 'apply') {
				forcedFreshActionRef.current = true;
				setSelectedAction('fresh');
			}
		} else if (forcedFreshActionRef.current) {
			forcedFreshActionRef.current = false;
			setSelectedAction('apply');
		}
	}, [canApplyToCurrent, selectedAction]);

	return (
		<VStack
			justify="flex-end"
			spacing={4}
			style={{ margin: 0 }}
			className={`${css.footer} ${css.formSection}`}
		>
			<div className={css.splitButton}>
				<Button
					type={primaryAction === 'apply' ? 'submit' : 'button'}
					variant="primary"
					className={
						primaryAction === 'apply'
							? css.applyButton
							: css.createFreshButton
					}
					onClick={
						primaryAction === 'apply'
							? undefined
							: () => void submit(onCreateFresh)()
					}
					disabled={isPending}
					isBusy={isPending}
				>
					{primaryAction === 'apply'
						? 'Apply to this Playground'
						: 'Create a fresh Playground'}
				</Button>
				<Dropdown
					className={css.splitButtonDropdown}
					focusOnMount={false}
					popoverProps={{
						placement: 'top-end',
						className: css.actionMenuPopover,
					}}
					renderToggle={({ isOpen, onToggle }) => (
						<Button
							type="button"
							variant="primary"
							className={
								primaryAction === 'apply'
									? css.splitButtonToggle
									: `${css.splitButtonToggle} ${css.createFreshButton}`
							}
							onClick={onToggle}
							aria-expanded={isOpen}
							aria-haspopup="menu"
							aria-label="More settings actions"
							disabled={isPending}
						>
							<span className={css.caret} aria-hidden="true" />
						</Button>
					)}
					renderContent={({ onClose }) => (
						<SettingsActionMenu
							canApplyToCurrent={canApplyToCurrent}
							applyUnavailableReason={applyUnavailableReason}
							selectedAction={primaryAction}
							siteName={siteName}
							sitePersistence={sitePersistence}
							onSelectApply={() => {
								onClose();
								forcedFreshActionRef.current = false;
								setSelectedAction('apply');
							}}
							onSelectCreateFresh={() => {
								onClose();
								forcedFreshActionRef.current = false;
								setSelectedAction('fresh');
							}}
						/>
					)}
				/>
			</div>
			{error && (
				<p className={css.actionError} role="alert">
					{error}
				</p>
			)}
		</VStack>
	);
}

function SettingsActionMenu({
	canApplyToCurrent,
	applyUnavailableReason,
	selectedAction,
	siteName,
	sitePersistence,
	onSelectApply,
	onSelectCreateFresh,
}: {
	canApplyToCurrent: boolean;
	applyUnavailableReason?: string;
	selectedAction: SettingsAction;
	siteName: string;
	sitePersistence: SitePersistence;
	onSelectApply: () => void;
	onSelectCreateFresh: () => void;
}) {
	const applyRef = useRef<HTMLButtonElement>(null);
	const freshRef = useRef<HTMLButtonElement>(null);
	const items = [applyRef, freshRef];

	useEffect(() => {
		(selectedAction === 'apply' && canApplyToCurrent
			? applyRef
			: freshRef
		).current?.focus();
	}, [canApplyToCurrent, selectedAction]);

	const moveFocus = (event: React.KeyboardEvent, nextIndex: number) => {
		event.preventDefault();
		items[nextIndex].current?.focus();
	};

	return (
		<div
			className={css.actionMenu}
			role="menu"
			onKeyDown={(event) => {
				const currentIndex = items.findIndex(
					(ref) => ref.current === document.activeElement
				);
				if (event.key === 'ArrowDown') {
					moveFocus(event, (currentIndex + 1) % items.length);
				} else if (event.key === 'ArrowUp') {
					moveFocus(
						event,
						(currentIndex - 1 + items.length) % items.length
					);
				} else if (event.key === 'Home') {
					moveFocus(event, 0);
				} else if (event.key === 'End') {
					moveFocus(event, items.length - 1);
				}
			}}
		>
			<button
				ref={applyRef}
				type="button"
				role="menuitem"
				aria-disabled={!!applyUnavailableReason}
				disabled={!!applyUnavailableReason}
				className={`${css.actionMenuItem} ${
					selectedAction === 'apply' && canApplyToCurrent
						? css.selectedApplyMenuItem
						: ''
				}`}
				onClick={onSelectApply}
			>
				<span className={css.actionMenuTitle}>
					Apply to this Playground
				</span>
				{applyUnavailableReason && (
					<span className={css.actionMenuDescription}>
						{applyUnavailableReason}
					</span>
				)}
			</button>
			<button
				ref={freshRef}
				type="button"
				role="menuitem"
				className={`${css.actionMenuItem} ${css.createFreshMenuItem}`}
				onClick={onSelectCreateFresh}
			>
				<span className={css.actionMenuTitle}>
					Create a fresh Playground
				</span>
				<span className={css.actionMenuDescription}>
					{sitePersistence === 'explicit' ? (
						<>
							Start a clean site. “{siteName}” stays in Saved
							Playgrounds.
						</>
					) : (
						<>
							Start a clean site. “{siteName}” stays in Recent
							autosaves until {MAX_AUTOSAVED_SITES} newer
							autosaves replace it.
						</>
					)}
				</span>
			</button>
		</div>
	);
}

export function TemporarySiteSettingsActionFooter({
	isPending,
	error,
}: {
	isPending: boolean;
	error?: string;
}) {
	return (
		<VStack
			justify="flex-end"
			spacing={4}
			style={{ margin: 0 }}
			className={`${css.footer} ${css.formSection}`}
		>
			<p className={css.temporaryWarning}>
				<strong>This temporary Playground will be lost forever.</strong>
				<span>
					Continuing permanently discards all of its files and
					changes.
				</span>
			</p>
			<Button
				type="submit"
				variant="primary"
				isDestructive
				className={css.temporaryActionButton}
				disabled={isPending}
				isBusy={isPending}
			>
				Discard current work &amp; create a fresh Playground
			</Button>
			{error && (
				<p className={css.actionError} role="alert">
					{error}
				</p>
			)}
		</VStack>
	);
}
