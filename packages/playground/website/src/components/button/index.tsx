import type { ButtonHTMLAttributes } from 'react';
import css from './style.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'default';
	size?: 'medium' | 'large';
}
export default function Button(props: ButtonProps) {
	const classNames = [
		css.button,
		props.variant === 'primary' ? css.isPrimary : '',
		props.size === 'large' ? css.isLarge : '',
		props.className || '',
	];
	return <button {...props} className={classNames.join(' ')} />;
}
