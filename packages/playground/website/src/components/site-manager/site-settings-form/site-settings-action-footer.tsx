import {
	Button,
	MenuGroup,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { useEffect, useRef, useState } from 'react';
import {
	MAX_AUTOSAVED_SITES,
	type SitePersistence,
} from '../../../lib/state/redux/site-lifecycle';
import { DropdownMenu } from '../../dropdown-menu';
import { MenuItemWithDescription } from '../../menu-item-with-description';
import type { SiteFormData } from './unconnected-site-settings-form';
import type { SiteSettingsFormFooterContext } from './unconnected-site-settings-form';
import { getFreshPlaygroundReason } from './site-settings-actions';
import css from './style.module.css';

type SettingsAction = 'apply' | 'fresh';

export function SiteSettingsActionFooter({
	sitePersistence,
	values,
	defaultValues,
	submit,
	onApply,
	onCreateFresh,
	isPending,
	error,
}: SiteSettingsFormFooterContext & {
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
				<DropdownMenu
					className={css.splitButtonDropdown}
					icon={null}
					label="More settings actions"
					toggleProps={{
						variant: 'primary',
						className:
							primaryAction === 'apply'
								? css.splitButtonToggle
								: `${css.splitButtonToggle} ${css.createFreshButton}`,
						disabled: isPending,
						showTooltip: false,
						children: (
							<span className={css.caret} aria-hidden="true" />
						),
					}}
					menuProps={{ className: css.actionMenu }}
					popoverProps={{
						placement: 'top-end',
						className: css.actionMenuPopover,
					}}
				>
					{({ onClose }) => (
						<SettingsActionMenu
							applyUnavailableReason={applyUnavailableReason}
							primaryAction={primaryAction}
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
				</DropdownMenu>
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
	applyUnavailableReason,
	primaryAction,
	sitePersistence,
	onSelectApply,
	onSelectCreateFresh,
}: {
	applyUnavailableReason?: string;
	primaryAction: SettingsAction;
	sitePersistence: SitePersistence;
	onSelectApply: () => void;
	onSelectCreateFresh: () => void;
}) {
	return (
		<MenuGroup className={css.actionMenuGroup}>
			<MenuItemWithDescription
				autoFocus={primaryAction === 'apply'}
				info={applyUnavailableReason}
				aria-disabled={!!applyUnavailableReason}
				className={`${css.actionMenuItem} ${
					primaryAction === 'apply' ? css.selectedApplyMenuItem : ''
				}`}
				onClick={applyUnavailableReason ? undefined : onSelectApply}
			>
				Apply to this Playground
			</MenuItemWithDescription>
			<MenuItemWithDescription
				autoFocus={primaryAction === 'fresh'}
				info={
					sitePersistence === 'explicit'
						? 'Start a clean site. Your current Playground stays in Saved Playgrounds.'
						: `Start a clean site. Your current Playground stays in Recent autosaves until ${MAX_AUTOSAVED_SITES} newer autosaves replace it.`
				}
				className={`${css.actionMenuItem} ${css.createFreshMenuItem}`}
				onClick={onSelectCreateFresh}
			>
				Create a fresh Playground
			</MenuItemWithDescription>
		</MenuGroup>
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
