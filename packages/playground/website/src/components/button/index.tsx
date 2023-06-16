import type { ButtonHTMLAttributes } from 'react';
import css from './style.module.css';

export default function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button {...props} className={css.button + ' ' + props?.className} />
	);
}
