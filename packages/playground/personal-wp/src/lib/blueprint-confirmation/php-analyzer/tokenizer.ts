/**
 * Simple PHP tokenizer for security analysis.
 *
 * This is not a full PHP parser - it's designed to identify potentially
 * dangerous patterns like function calls, variable usage, and string literals.
 */

export type TokenType =
	| 'T_OPEN_TAG'
	| 'T_CLOSE_TAG'
	| 'T_VARIABLE'
	| 'T_STRING' // identifiers, function names
	| 'T_CONSTANT_STRING' // 'string' or "string"
	| 'T_NUMBER'
	| 'T_WHITESPACE'
	| 'T_COMMENT'
	| 'T_OPERATOR'
	| 'T_SEMICOLON'
	| 'T_OPEN_PAREN'
	| 'T_CLOSE_PAREN'
	| 'T_OPEN_BRACKET'
	| 'T_CLOSE_BRACKET'
	| 'T_OPEN_BRACE'
	| 'T_CLOSE_BRACE'
	| 'T_COMMA'
	| 'T_DOUBLE_COLON'
	| 'T_ARROW'
	| 'T_DOUBLE_ARROW'
	| 'T_BACKTICK_STRING'
	| 'T_UNKNOWN';

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
}

/**
 * Tokenize PHP code into a stream of tokens.
 */
export function tokenize(code: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;
	let line = 1;
	let column = 1;

	const updatePosition = (consumed: string) => {
		for (const char of consumed) {
			if (char === '\n') {
				line++;
				column = 1;
			} else {
				column++;
			}
		}
		pos += consumed.length;
	};

	const addToken = (type: TokenType, value: string) => {
		tokens.push({ type, value, line, column });
		updatePosition(value);
	};

	const peek = (offset = 0): string => code[pos + offset] || '';
	const remaining = (): string => code.slice(pos);

	while (pos < code.length) {
		const char = peek();
		const rest = remaining();

		// PHP open tags
		if (rest.startsWith('<?php')) {
			addToken('T_OPEN_TAG', '<?php');
			continue;
		}
		if (rest.startsWith('<?=')) {
			addToken('T_OPEN_TAG', '<?=');
			continue;
		}
		if (rest.startsWith('<?')) {
			addToken('T_OPEN_TAG', '<?');
			continue;
		}
		if (rest.startsWith('?>')) {
			addToken('T_CLOSE_TAG', '?>');
			continue;
		}

		// Whitespace
		const wsMatch = rest.match(/^[\s]+/);
		if (wsMatch) {
			addToken('T_WHITESPACE', wsMatch[0]);
			continue;
		}

		// Comments
		if (rest.startsWith('//') || rest.startsWith('#')) {
			const endOfLine = rest.indexOf('\n');
			const comment = endOfLine === -1 ? rest : rest.slice(0, endOfLine);
			addToken('T_COMMENT', comment);
			continue;
		}
		if (rest.startsWith('/*')) {
			const endComment = rest.indexOf('*/');
			const comment =
				endComment === -1 ? rest : rest.slice(0, endComment + 2);
			addToken('T_COMMENT', comment);
			continue;
		}

		// Backtick strings (shell execution)
		if (char === '`') {
			let str = '`';
			let i = 1;
			while (pos + i < code.length && code[pos + i] !== '`') {
				if (code[pos + i] === '\\' && pos + i + 1 < code.length) {
					str += code[pos + i] + code[pos + i + 1];
					i += 2;
				} else {
					str += code[pos + i];
					i++;
				}
			}
			if (pos + i < code.length) {
				str += '`';
			}
			addToken('T_BACKTICK_STRING', str);
			continue;
		}

		// Strings
		if (char === '"' || char === "'") {
			const quote = char;
			let str = quote;
			let i = 1;
			while (pos + i < code.length && code[pos + i] !== quote) {
				if (code[pos + i] === '\\' && pos + i + 1 < code.length) {
					str += code[pos + i] + code[pos + i + 1];
					i += 2;
				} else {
					str += code[pos + i];
					i++;
				}
			}
			if (pos + i < code.length) {
				str += quote;
			}
			addToken('T_CONSTANT_STRING', str);
			continue;
		}

		// Variables
		if (char === '$') {
			const varMatch = rest.match(
				/^\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/
			);
			if (varMatch) {
				addToken('T_VARIABLE', varMatch[0]);
				continue;
			}
		}

		// Numbers
		const numMatch = rest.match(
			/^(?:0x[0-9a-fA-F]+|0b[01]+|0[0-7]+|\d+\.?\d*(?:e[+-]?\d+)?)/i
		);
		if (numMatch) {
			addToken('T_NUMBER', numMatch[0]);
			continue;
		}

		// Multi-character operators
		if (rest.startsWith('::')) {
			addToken('T_DOUBLE_COLON', '::');
			continue;
		}
		if (rest.startsWith('->')) {
			addToken('T_ARROW', '->');
			continue;
		}
		if (rest.startsWith('=>')) {
			addToken('T_DOUBLE_ARROW', '=>');
			continue;
		}

		// Identifiers (function names, keywords, etc.)
		const idMatch = rest.match(/^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/);
		if (idMatch) {
			addToken('T_STRING', idMatch[0]);
			continue;
		}

		// Single character tokens
		switch (char) {
			case '(':
				addToken('T_OPEN_PAREN', char);
				break;
			case ')':
				addToken('T_CLOSE_PAREN', char);
				break;
			case '[':
				addToken('T_OPEN_BRACKET', char);
				break;
			case ']':
				addToken('T_CLOSE_BRACKET', char);
				break;
			case '{':
				addToken('T_OPEN_BRACE', char);
				break;
			case '}':
				addToken('T_CLOSE_BRACE', char);
				break;
			case ';':
				addToken('T_SEMICOLON', char);
				break;
			case ',':
				addToken('T_COMMA', char);
				break;
			default:
				// Operators and other characters
				const opMatch = rest.match(/^[+\-*\/%&|^~<>=!?.@:\\]+/);
				if (opMatch) {
					addToken('T_OPERATOR', opMatch[0]);
				} else {
					addToken('T_UNKNOWN', char);
				}
		}
	}

	return tokens;
}

/**
 * Filter out whitespace and comment tokens.
 */
export function filterSignificantTokens(tokens: Token[]): Token[] {
	return tokens.filter(
		(t) => t.type !== 'T_WHITESPACE' && t.type !== 'T_COMMENT'
	);
}
