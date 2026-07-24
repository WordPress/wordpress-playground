import type { ReactNode } from 'react';
import classNames from 'classnames';
import css from './style.module.css';

interface OverlaySectionProps {
	children: ReactNode;
	title?: string;
	description?: string;
	className?: string;
}

export function OverlaySection({
	children,
	title,
	description,
	className,
}: OverlaySectionProps) {
	return (
		<section className={classNames(css.section, className)}>
			{title && <h2 className={css.sectionTitle}>{title}</h2>}
			{description && (
				<p className={css.sectionDescription}>{description}</p>
			)}
			{children}
		</section>
	);
}
