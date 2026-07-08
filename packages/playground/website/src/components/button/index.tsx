import type { ButtonHTMLAttributes } from 'react';
import css from './style.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'browser-chrome' | 'default';
	size?: 'medium' | 'large';
}
export default function Button(props: ButtonProps) {
	const { variant, size, className, type, ...rest } = props;
	const classNames = [
		css.button,
		variant === 'primary'
			? css.isPrimary
			: variant === 'browser-chrome'
				? css.isBrowserChrome
				: '',
		size === 'large' ? css.isLarge : '',
		className || '',
	];
	// Default to type="button" so a Button placed inside a <form> (e.g. the
	// export success "Close" action) does not implicitly submit the form and
	// re-fire its handler. Submit buttons opt in explicitly with type="submit".
	return (
		<button
			type={type ?? 'button'}
			{...rest}
			className={classNames.join(' ')}
		/>
	);
}
