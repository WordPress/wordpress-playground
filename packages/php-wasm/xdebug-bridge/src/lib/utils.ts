export function findFirstDebuggableLine(content: string) {
	const lines = content.split('\n');
	let inBlockComment = false;
	let inFunctionOrClass = false;
	let braceDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		const lineRaw = lines[i];
		const line = lineRaw.trim();

		if (line === '') continue;

		if (line.startsWith('/*')) {
			inBlockComment = true;
			continue;
		}

		if (inBlockComment) {
			if (line.includes('*/')) inBlockComment = false;
			continue;
		}

		if (line.match(/^\s*(function|class)\b/)) {
			inFunctionOrClass = true;
		}

		braceDepth += (line.match(/{/g) || []).length;
		braceDepth -= (line.match(/}/g) || []).length;

		if (inFunctionOrClass && braceDepth === 0) {
			inFunctionOrClass = false;
			continue;
		}

		if (inFunctionOrClass || braceDepth > 0) {
			continue;
		}

		if (
			line.startsWith('//') ||
			line.startsWith('#') ||
			line === '<?php' ||
			line === '?>'
		) {
			continue;
		}

		if (
			line.match(
				/^\s*(var_dump|print|echo|exit|die|return|require|include|define|[$]\w+|\w+\s*\()/
			)
		) {
			return i + 1;
		}
	}

	return 0;
}
