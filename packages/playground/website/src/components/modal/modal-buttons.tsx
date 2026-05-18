import { Button, Flex } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import React from 'react';
import css from './style.module.css';

interface ModalButtonsProps {
	submitText?: string;
	areDisabled?: boolean;
	areBusy?: boolean;
	onCancel?: () => void;
	onSubmit?: (e: any) => void;
	style?: React.CSSProperties;
}
export default function ModalButtons({
	submitText = __('Submit', 'playground-website'),
	areDisabled = false,
	areBusy,
	onCancel,
	onSubmit,
	style,
}: ModalButtonsProps) {
	return (
		<Flex justify="end" className={css.modalButtons} style={style}>
			<Button
				type="button"
				isBusy={areBusy}
				disabled={areDisabled}
				variant="link"
				onClick={onCancel}
			>
				{__('Cancel', 'playground-website')}
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
