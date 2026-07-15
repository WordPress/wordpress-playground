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
	areBusy?: boolean;
	onCancel?: () => void;
	onSubmit?: (e: any) => void;
	style?: React.CSSProperties;
}
export default function ModalButtons({
	submitText = 'Submit',
	areDisabled = false,
	cancelDisabled,
	areBusy,
	onCancel,
	onSubmit,
	style,
}: ModalButtonsProps) {
	const isCancelDisabled = cancelDisabled ?? areDisabled;

	return (
		<Flex justify="end" className={css.modalButtons} style={style}>
			<Button
				type="button"
				isBusy={areBusy}
				disabled={isCancelDisabled}
				variant="link"
				onClick={onCancel}
			>
				Cancel
			</Button>
			<Button
				type="submit"
				isBusy={areBusy}
				disabled={areDisabled}
				variant="primary"
				onClick={onSubmit}
			>
				{submitText}
			</Button>
		</Flex>
	);
}
