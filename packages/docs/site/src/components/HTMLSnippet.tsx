import React from 'react';
import CodeBlock from '@theme/CodeBlock';

export default (props) => (
	<>
		<CodeBlock language="html">{props.children}</CodeBlock>
		<div dangerouslySetInnerHTML={{ __html: props.children }} />
	</>
);
