import css from './style.module.css';
import { Spinner } from '../spinner';
import Button from '../button';
import type { ButtonProps } from '../button';

interface OPFSButtonProps extends ButtonProps {
	isMounting: boolean;
	mountProgress?: {
		files: number;
		total: number;
	};
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	children?: React.ReactNode;
}

export function OPFSButton({
	isMounting,
	mountProgress,
	onClick,
	children,
	...rest
}: OPFSButtonProps) {
	if (!isMounting) {
		return (
			<Button
				className={css.buttonWithSpinner}
				onClick={onClick}
				{...rest}
			>
				{children}
			</Button>
		);
	}

	return (
		<Button className={css.buttonWithSpinner} {...rest}>
			<Spinner size={24} />
			{mountProgress ? (
				<>
					{mountProgress.files} {' / '}
					{mountProgress.total} files saved
				</>
			) : (
				'Syncing...'
			)}
		</Button>
	);
}
