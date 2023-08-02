import css from './style.module.css';

interface SpinnerProps {
	size?: number;
}

export function Spinner({ size = 50 }: SpinnerProps) {
	return (
		<div
			className={css.spinner}
			style={{
				width: size,
				height: size,
			}}
		></div>
	);
}
