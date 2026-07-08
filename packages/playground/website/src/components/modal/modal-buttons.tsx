import { Button, Flex } from '@wordpress/components';
import React from 'react';
import css from './style.module.css';

interface ModalButtonsProps {
	submitText?: string;
	areDisabled?: boolean;
	// Cancel stays clickable by default even when the form is incomplete — a
	// dead-end dialog you can't back out of is a trap. Only pass this true to
	// lock Cancel during an in-flight operation you don't want interrupted.
	cancelDisabled?: boolean;
	areBusy?: boolean;
	onCancel?: () => void;
	onSubmit?: (e: any) => void;
	style?: React.CSSProperties;
}
export default function ModalButtons({
	submitText = 'Submit',
	areDisabled = false,
	cancelDisabled = false,
	areBusy,
	onCancel,
	onSubmit,
	style,
}: ModalButtonsProps) {
	return (
		<Flex justify="end" gap={4} className={css.modalButtons} style={style}>
			<Button
				type="button"
				isBusy={areBusy}
				disabled={cancelDisabled}
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
