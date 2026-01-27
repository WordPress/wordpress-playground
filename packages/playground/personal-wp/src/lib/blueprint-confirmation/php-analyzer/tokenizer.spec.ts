import { describe, it, expect } from 'vitest';
import { tokenize, filterSignificantTokens } from './tokenizer';

describe('tokenize', () => {
	describe('PHP tags', () => {
		it('tokenizes <?php open tag', () => {
			const tokens = tokenize('<?php echo 1;');
			expect(tokens[0]).toMatchObject({
				type: 'T_OPEN_TAG',
				value: '<?php',
			});
		});

		it('tokenizes <?= short echo tag', () => {
			const tokens = tokenize('<?= $var ?>');
			expect(tokens[0]).toMatchObject({
				type: 'T_OPEN_TAG',
				value: '<?=',
			});
		});

		it('tokenizes ?> close tag', () => {
			const tokens = tokenize('<?php echo 1; ?>');
			const closeTag = tokens.find((t) => t.type === 'T_CLOSE_TAG');
			expect(closeTag?.value).toBe('?>');
		});
	});

	describe('variables', () => {
		it('tokenizes simple variables', () => {
			const tokens = tokenize('<?php $foo');
			const varToken = tokens.find((t) => t.type === 'T_VARIABLE');
			expect(varToken?.value).toBe('$foo');
		});

		it('tokenizes superglobals', () => {
			const tokens = tokenize('<?php $_GET["x"]');
			const varToken = tokens.find((t) => t.type === 'T_VARIABLE');
			expect(varToken?.value).toBe('$_GET');
		});

		it('tokenizes variables with underscores and numbers', () => {
			const tokens = tokenize('<?php $my_var_123');
			const varToken = tokens.find((t) => t.type === 'T_VARIABLE');
			expect(varToken?.value).toBe('$my_var_123');
		});
	});

	describe('strings', () => {
		it('tokenizes single-quoted strings', () => {
			const tokens = tokenize("<?php 'hello world'");
			const strToken = tokens.find((t) => t.type === 'T_CONSTANT_STRING');
			expect(strToken?.value).toBe("'hello world'");
		});

		it('tokenizes double-quoted strings', () => {
			const tokens = tokenize('<?php "hello world"');
			const strToken = tokens.find((t) => t.type === 'T_CONSTANT_STRING');
			expect(strToken?.value).toBe('"hello world"');
		});

		it('handles escaped quotes in strings', () => {
			const tokens = tokenize("<?php 'it\\'s fine'");
			const strToken = tokens.find((t) => t.type === 'T_CONSTANT_STRING');
			expect(strToken?.value).toBe("'it\\'s fine'");
		});
	});

	describe('backtick strings (shell execution)', () => {
		it('tokenizes backtick strings', () => {
			const tokens = tokenize('<?php `ls -la`');
			const btToken = tokens.find((t) => t.type === 'T_BACKTICK_STRING');
			expect(btToken?.value).toBe('`ls -la`');
		});
	});

	describe('identifiers (function names)', () => {
		it('tokenizes function names', () => {
			const tokens = tokenize('<?php strtolower($str)');
			const significant = filterSignificantTokens(tokens);
			expect(significant[1]).toMatchObject({
				type: 'T_STRING',
				value: 'strtolower',
			});
		});

		it('tokenizes namespaced identifiers', () => {
			const tokens = tokenize('<?php Some\\Namespace\\func()');
			const strings = tokens.filter((t) => t.type === 'T_STRING');
			expect(strings.map((t) => t.value)).toContain('Some');
			expect(strings.map((t) => t.value)).toContain('Namespace');
			expect(strings.map((t) => t.value)).toContain('func');
		});
	});

	describe('comments', () => {
		it('tokenizes single-line // comments', () => {
			const tokens = tokenize('<?php // this is a comment\n$x = 1;');
			const comment = tokens.find((t) => t.type === 'T_COMMENT');
			expect(comment?.value).toBe('// this is a comment');
		});

		it('tokenizes single-line # comments', () => {
			const tokens = tokenize('<?php # hash comment\n$x = 1;');
			const comment = tokens.find((t) => t.type === 'T_COMMENT');
			expect(comment?.value).toBe('# hash comment');
		});

		it('tokenizes multi-line comments', () => {
			const tokens = tokenize('<?php /* multi\nline */ $x');
			const comment = tokens.find((t) => t.type === 'T_COMMENT');
			expect(comment?.value).toBe('/* multi\nline */');
		});
	});

	describe('operators and punctuation', () => {
		it('tokenizes parentheses', () => {
			const tokens = tokenize('<?php func()');
			expect(tokens.some((t) => t.type === 'T_OPEN_PAREN')).toBe(true);
			expect(tokens.some((t) => t.type === 'T_CLOSE_PAREN')).toBe(true);
		});

		it('tokenizes brackets', () => {
			const tokens = tokenize('<?php $arr[0]');
			expect(tokens.some((t) => t.type === 'T_OPEN_BRACKET')).toBe(true);
			expect(tokens.some((t) => t.type === 'T_CLOSE_BRACKET')).toBe(true);
		});

		it('tokenizes arrow operator', () => {
			const tokens = tokenize('<?php $obj->method()');
			expect(tokens.some((t) => t.type === 'T_ARROW')).toBe(true);
		});

		it('tokenizes double colon', () => {
			const tokens = tokenize('<?php Class::method()');
			expect(tokens.some((t) => t.type === 'T_DOUBLE_COLON')).toBe(true);
		});

		it('tokenizes double arrow', () => {
			const tokens = tokenize('<?php ["key" => "value"]');
			expect(tokens.some((t) => t.type === 'T_DOUBLE_ARROW')).toBe(true);
		});
	});

	describe('line tracking', () => {
		it('tracks line numbers correctly', () => {
			const code = '<?php\n$line2 = 1;\n$line3 = 2;';
			const tokens = tokenize(code);
			const line2Var = tokens.find((t) => t.value === '$line2');
			const line3Var = tokens.find((t) => t.value === '$line3');
			expect(line2Var?.line).toBe(2);
			expect(line3Var?.line).toBe(3);
		});
	});

	describe('filterSignificantTokens', () => {
		it('removes whitespace and comments', () => {
			const tokens = tokenize('<?php /* comment */ $x = 1; // end');
			const significant = filterSignificantTokens(tokens);
			expect(significant.every((t) => t.type !== 'T_WHITESPACE')).toBe(
				true
			);
			expect(significant.every((t) => t.type !== 'T_COMMENT')).toBe(true);
		});
	});
});
