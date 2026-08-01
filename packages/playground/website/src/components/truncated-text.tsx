import { Tooltip } from '@wordpress/components';
import { useLayoutEffect, useRef, useState } from 'react';

/** Shows a zero-delay tooltip only when the rendered text is actually clipped. */
export function TruncatedText({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	const textRef = useRef<HTMLSpanElement>(null);
	const [isTruncated, setIsTruncated] = useState(false);

	useLayoutEffect(() => {
		const element = textRef.current;
		if (!element) {
			return;
		}
		measure(element);
		const frame = window.requestAnimationFrame(() => measure(element));
		const observer =
			typeof ResizeObserver === 'undefined'
				? undefined
				: new ResizeObserver(() => measure(element));
		observer?.observe(element);
		return () => {
			window.cancelAnimationFrame(frame);
			observer?.disconnect();
		};
	}, [children]);

	const text = (
		<span
			ref={textRef}
			className={className}
			tabIndex={isTruncated ? 0 : -1}
			onMouseEnter={(event) => measure(event.currentTarget)}
			onFocus={(event) => measure(event.currentTarget)}
		>
			{children}
		</span>
	);

	return (
		<Tooltip
			text={isTruncated ? children : undefined}
			placement="top"
			delay={0}
		>
			{text}
		</Tooltip>
	);

	function measure(element: HTMLElement) {
		setIsTruncated(
			element.scrollWidth > element.clientWidth ||
				element.scrollHeight > element.clientHeight
		);
	}
}
