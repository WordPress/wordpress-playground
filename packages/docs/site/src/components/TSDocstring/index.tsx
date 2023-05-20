import { getByPath } from '@site/src/typedoc-model';
import React from 'react';
import { SignatureReflection } from 'typedoc';
import CodeBlock from '@theme/CodeBlock';
import ReactMarkdown from 'react-markdown';

interface TSDocstringProps {
	path: string[];
}

const TSDocstring: React.FC<TSDocstringProps> = ({ path }) => {
	const member = getByPath(...path);
	const signature = (member as any)?.signatures?.[0] as
		| SignatureReflection
		| undefined;
	if (!signature?.comment) {
		return null;
	}
	const textComments = signature.comment?.summary
		?.map((comment) => comment.text)
		.filter((comment) => comment)
		.join('');

	if (!textComments?.length) {
		return null;
	}
	return (
		<ReactMarkdown
			components={{
				...shiftHeadersByN(2),
				pre: ({ children }) => <>{children}</>,
				code: ({ className, children, inline }) => {
					if (inline) return <code>{children}</code>;
					const language = className?.replace(/^language-/, '');
					return (
						<CodeBlock language={language}>{children}</CodeBlock>
					);
				},
			}}
		>
			{textComments}
		</ReactMarkdown>
	);
};

function shiftHeadersByN(n: number): Record<string, string> {
	const headers: Record<string, string> = {};
	for (let i = 1; i <= n; i++) {
		headers[`h${i}`] = `h${Math.min(i + n, 6)}`;
	}
	return headers;
}

export default TSDocstring;
