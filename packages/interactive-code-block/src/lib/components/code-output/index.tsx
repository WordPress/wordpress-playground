import { useEffect, useMemo, useState } from 'react';
import { useHasTransitionClassName } from '../../hooks/use-has-transition-class-name';
import { OutputFormat } from '../../types';
// @ts-ignore
import classes from './style.module.css';

interface CodeOutputProps {
	result?: string;
	isRunning: boolean;
	outputFormat?: OutputFormat;
}
export function CodeOutput({
	result,
	isRunning,
	outputFormat,
}: CodeOutputProps) {
	const hasIsReadyClass = useHasTransitionClassName(!isRunning, 250);
	const [displaySpinner, setDisplaySpinner] = useState(false);

	// Only show the spinner if the PHP is taking a while to execute the code
	useEffect(() => {
		if (!isRunning) {
			setDisplaySpinner(false);
			return;
		}

		const timeout = setTimeout(() => {
			setDisplaySpinner(true);
		}, 20);
		return () => clearTimeout(timeout);
	}, [isRunning]);

	const className = [
		classes.output,
		hasIsReadyClass ? classes.isReady : '',
		displaySpinner ? 'is-spinner-active' : '',
	].join(' ');

	return (
		<div>
			<div className={classes.title}>Output:</div>
			{(function () {
				switch (outputFormat) {
					case 'jsontabular':
						return (
							<JSONTabularResult
								className={className}
								resultString={result as any}
							/>
						);
					case 'html':
						return (
							<HTMLResult
								className={className}
								result={result!}
							/>
						);
					default:
					case 'plaintext':
						return (
							<PlaintextResult
								className={className}
								result={result!}
							/>
						);
				}
			})()}
		</div>
	);
}

interface ResultsTableProps {
	resultString: string;
	className: string;
}

const INVALID_JSON = {};

function JSONTabularResult({ resultString, className }: ResultsTableProps) {
	const results = useMemo(() => {
		try {
			return JSON.parse(resultString);
		} catch (e) {
			return INVALID_JSON;
		}
	}, [resultString]);
	if (results === INVALID_JSON) {
		return (
			<PlaintextResult
				className={className}
				result={JSON.stringify(resultString)}
			/>
		);
	}
	if (!results.length) {
		return null;
	}

	const headers = Object.keys(results[0]);

	const headerHtml = (
		<tr>
			{headers.map((header) => (
				<th>{header}</th>
			))}
		</tr>
	);

	const rowHtml = results.map((result: any) => (
		<tr>
			{headers.map((header) => (
				<td>{result[header]}</td>
			))}
		</tr>
	));

	return (
		<div className={`${className} format-jsontabular`}>
			<table className={classes.jsonTabular}>
				<thead>{headerHtml}</thead>
				<tbody>{rowHtml}</tbody>
			</table>
		</div>
	);
}

function HTMLResult({
	result,
	className,
}: {
	result: string;
	className: string;
}) {
	return (
		<div
			className={className}
			dangerouslySetInnerHTML={{ __html: result }}
		></div>
	);
}

function PlaintextResult({
	result,
	className,
}: {
	result: string;
	className: string;
}) {
	return (
		<div className={`${className} format-plaintext`}>
			<pre>{result}</pre>
		</div>
	);
}
