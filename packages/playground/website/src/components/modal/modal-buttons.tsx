import { Button, Flex } from '@wordpress/components';
import React from 'react';
import css from './style.module.css';

interface ModalButtonsProps {
	submitText?: string;
	areDisabled?: boolean;
	/**
	 * Overrides the legacy behavior where `areDisabled` disables both buttons.
	 * Pane forms can keep Cancel available while only submission is invalid.
	 */
	cancelDisabled?: boolean;
	submitBusy?: boolean;
	submitDestructive?: boolean;
	onCancel?: () => void;
	onSubmit?: (e: any) => void;
	style?: React.CSSProperties;
}
export default function ModalButtons({
	submitText = 'Submit',
	areDisabled = false,
	cancelDisabled,
	submitBusy,
	submitDestructive,
	onCancel,
	onSubmit,
	style,
}: ModalButtonsProps) {
	const isCancelDisabled = cancelDisabled ?? areDisabled;

	return (
		<Flex gap={4} justify="end" className={css.modalButtons} style={style}>
			<Button
				type="button"
				disabled={isCancelDisabled}
				variant="link"
				onClick={onCancel}
			>
				Cancel
			</Button>
			<Button
				type="submit"
				isBusy={submitBusy}
				isDestructive={submitDestructive}
				disabled={areDisabled}
				variant="primary"
				onClick={onSubmit}
			>
				{submitText}
			</Button>
		</Flex>
	);
}
