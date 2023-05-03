import { render } from '@wordpress/element';
import { base64ToUtf8 } from './base64-utils';
import { InteractiveCodeSnippet } from '../components/interactive-code-snippet';
import {
	ExecutionScript,
	Library,
	InteractiveCodeSnippetBlockAttributes,
} from '../types';
import {
	getDefaultExecutionScript,
	isDefaultScriptId,
} from '../components/code-runner';

// Assume DOM ready at this point
const elems = Array.from(
	document.querySelectorAll('.wp-playground-interactive-code-snippet')
) as HTMLElement[];
for (const elem of elems) {
	const {
		code,
		cachedOutput,
		showCachedOutput,
		executionScript,
		executionScriptId,
		fileType,
		libraries,
	} = elem.dataset;
	const typedFileType =
		fileType as InteractiveCodeSnippetBlockAttributes['fileType'];
	let scriptId = '';
	try {
		scriptId = JSON.parse(executionScriptId as string);
	} catch (e) {
		// Ignore error
	}
	const script = isDefaultScriptId(scriptId)
		? getDefaultExecutionScript(scriptId)
		: (JSON.parse(executionScript as string) as ExecutionScript);

	render(
		<InteractiveCodeSnippet
			fileType={typedFileType || 'php'}
			executionScript={script!}
			libraries={JSON.parse(libraries!) as Library[]}
			initialCode={base64ToUtf8(code!)}
			initialOutput={
				showCachedOutput && cachedOutput
					? base64ToUtf8(cachedOutput)
					: undefined
			}
		/>,
		elem
	);
}
