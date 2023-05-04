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
					case 'jsontabularsql':
						return (
							<JSONTabularSQLResult
								className={className}
								resultString={result as any}
							/>
						);
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

function JSONTabularSQLResult({ resultString, className }: ResultsTableProps) {
	const [sqlHighlighter, setSqlHighlighter] =
		useState<CellRenderer>(defaultCellRenderer);
	useEffect(() => {
		makeSQLHighlighter().then((highlighter) =>
			setSqlHighlighter(() => (header: string, value: string) => {
				if (header === 'query') {
					return (
						<span
							style={{ fontFamily: 'monospace' }}
							dangerouslySetInnerHTML={{
								__html: highlighter(value),
							}}
						/>
					);
				} else if (header === 'params') {
					if (['[]', 'null'].includes(value)) {
						return '';
					}
					return (
						<pre>{JSON.stringify(JSON.parse(value), null, 2)}</pre>
					);
				}
				return value;
			})
		);
	}, []);
	if (!sqlHighlighter) {
		className = `${classes.output} is-spinner-active`;
	}
	return (
		<JSONTabularResult
			resultString={resultString}
			className={className}
			cellRenderer={sqlHighlighter}
		/>
	);
}

function makeSQLHighlighter() {
	type Token = {
		from: number;
		to: number;
		classes: string;
	};
	return Promise.all([
		import('@codemirror/lang-sql'),
		import('@lezer/highlight'),
		import('@codemirror/language'),
	]).then(([sql, { highlightTree }, { defaultHighlightStyle }]) => {
		return (query: string) => {
			const parser = sql.SQLite.language.parser;
			const result = parser.parse(query);

			const output = document.createElement('div');

			function addToken({ from, to, classes }: Token) {
				const span = document.createElement('SPAN');
				span.className = classes;
				span.innerText = query.slice(from, to);
				output.appendChild(span);
			}
			let lastToken: Token | null = null;
			highlightTree(
				result as any,
				defaultHighlightStyle,
				(from: number, to: number, classes: string) => {
					if (lastToken && lastToken.to !== from) {
						addToken({
							from: lastToken!.to,
							to: from,
							classes: '',
						});
					}
					const token = { from, to, classes };
					addToken(token);
					lastToken = token;
				}
			);
			if (lastToken as any) {
				addToken({
					from: (lastToken as any)?.to,
					to: query.length,
					classes: '',
				});
			}
			return output.outerHTML;
		};
	});
}

type CellRenderer = (header: string, value: string) => string | JSX.Element;
interface ResultsTableProps {
	resultString: string;
	className: string;
	cellRenderer?: CellRenderer;
}

const INVALID_JSON = {};

function defaultCellRenderer(header: string, value: string) {
	return value;
}
function JSONTabularResult({
	resultString,
	className,
	cellRenderer = defaultCellRenderer,
}: ResultsTableProps) {
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
				result={toJSONString(resultString)}
			/>
		);
	}
	if (!Array.isArray(results) || !results.length) {
		return <span>{'<No data>'}</span>;
	}

	const headers = Object.keys(results[0]);

	const headerHtml = (
		<tr>
			{headers.map((header) => (
				<th>{toJSONString(header)}</th>
			))}
		</tr>
	);

	const rowHtml = results.map((result: any) => (
		<tr>
			{headers.map((header) => (
				<td>{cellRenderer(header, toJSONString(result[header]))}</td>
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

function toJSONString(value: any) {
	if (typeof value === 'string') {
		return value;
	}
	return JSON.stringify(value, null, 2);
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
