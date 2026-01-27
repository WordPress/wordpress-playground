import { describe, it, expect } from 'vitest';
import { analyzePhpCode, groupFindingsBySeverity } from './analyzer';

describe('analyzePhpCode', () => {
	describe('dangerous function detection', () => {
		it('detects code execution functions as danger', () => {
			// Testing security detection - these are patterns we want to catch
			const findings = analyzePhpCode('<?php eval($code);');
			expect(
				findings.some(
					(f) => f.severity === 'danger' && f.name === 'eval'
				)
			).toBe(true);
		});

		it('detects shell functions as danger', () => {
			const findings = analyzePhpCode('<?php system("ls");');
			expect(
				findings.some(
					(f) => f.severity === 'danger' && f.name === 'system'
				)
			).toBe(true);
		});

		it('detects network functions as danger', () => {
			const findings = analyzePhpCode('<?php fsockopen("evil.com", 80);');
			expect(
				findings.some(
					(f) => f.severity === 'danger' && f.name === 'fsockopen'
				)
			).toBe(true);
		});
	});

	describe('warning function detection', () => {
		it('detects file operations as warning', () => {
			const findings = analyzePhpCode(
				'<?php file_get_contents("http://example.com");'
			);
			expect(
				findings.some(
					(f) =>
						f.severity === 'warning' &&
						f.name === 'file_get_contents'
				)
			).toBe(true);
		});

		it('detects base64_decode as warning (obfuscation)', () => {
			const findings = analyzePhpCode('<?php base64_decode($data);');
			expect(
				findings.some(
					(f) =>
						f.severity === 'warning' && f.name === 'base64_decode'
				)
			).toBe(true);
		});

		it('detects WordPress user functions as warning', () => {
			const findings = analyzePhpCode('<?php wp_insert_user($userdata);');
			expect(
				findings.some(
					(f) =>
						f.severity === 'warning' && f.name === 'wp_insert_user'
				)
			).toBe(true);
		});
	});

	describe('info function detection', () => {
		it('detects phpinfo as info', () => {
			const findings = analyzePhpCode('<?php phpinfo();');
			expect(
				findings.some(
					(f) => f.severity === 'info' && f.name === 'phpinfo'
				)
			).toBe(true);
		});

		it('detects WordPress option functions as info', () => {
			const findings = analyzePhpCode(
				'<?php update_option("key", "value");'
			);
			expect(
				findings.some(
					(f) => f.severity === 'info' && f.name === 'update_option'
				)
			).toBe(true);
		});
	});

	describe('superglobal detection', () => {
		it('detects $_GET access', () => {
			const findings = analyzePhpCode('<?php $x = $_GET["param"];');
			expect(
				findings.some(
					(f) => f.type === 'superglobal' && f.name === '$_GET'
				)
			).toBe(true);
		});

		it('detects $_POST access', () => {
			const findings = analyzePhpCode('<?php $x = $_POST["data"];');
			expect(
				findings.some(
					(f) => f.type === 'superglobal' && f.name === '$_POST'
				)
			).toBe(true);
		});

		it('detects $_REQUEST access', () => {
			const findings = analyzePhpCode('<?php $x = $_REQUEST["input"];');
			expect(
				findings.some(
					(f) => f.type === 'superglobal' && f.name === '$_REQUEST'
				)
			).toBe(true);
		});

		it('detects $_COOKIE access', () => {
			const findings = analyzePhpCode('<?php $x = $_COOKIE["session"];');
			expect(
				findings.some(
					(f) => f.type === 'superglobal' && f.name === '$_COOKIE'
				)
			).toBe(true);
		});
	});

	describe('variable function detection', () => {
		it('detects variable function calls', () => {
			const findings = analyzePhpCode(
				'<?php $func = "system"; $func("ls");'
			);
			expect(findings.some((f) => f.type === 'variable_function')).toBe(
				true
			);
		});

		it('detects array-based variable function calls', () => {
			const findings = analyzePhpCode('<?php $funcs["cmd"]("ls");');
			expect(findings.some((f) => f.type === 'variable_function')).toBe(
				true
			);
		});
	});

	describe('backtick detection', () => {
		it('detects backtick shell execution', () => {
			const findings = analyzePhpCode('<?php $output = `whoami`;');
			expect(findings.some((f) => f.type === 'backtick_exec')).toBe(true);
		});
	});

	describe('safe code', () => {
		it('returns empty for safe code', () => {
			const findings = analyzePhpCode('<?php echo "Hello World";');
			expect(findings).toHaveLength(0);
		});

		it('returns empty for simple variable assignments', () => {
			const findings = analyzePhpCode('<?php $x = 1; $y = $x + 2;');
			expect(findings).toHaveLength(0);
		});

		it('returns empty for safe string operations', () => {
			const findings = analyzePhpCode(
				'<?php $name = strtolower($input);'
			);
			expect(findings).toHaveLength(0);
		});
	});

	describe('line numbers', () => {
		it('reports correct line numbers', () => {
			const code = '<?php\n$x = 1;\neval($code);';
			const findings = analyzePhpCode(code);
			const evalFinding = findings.find((f) => f.name === 'eval');
			expect(evalFinding?.line).toBe(3);
		});
	});

	describe('multiple findings', () => {
		it('detects multiple issues in same code', () => {
			const code = '<?php eval($_GET["cmd"]); system($x);';
			const findings = analyzePhpCode(code);
			expect(findings.length).toBeGreaterThanOrEqual(3); // eval, $_GET, system
		});
	});

	describe('groupFindingsBySeverity', () => {
		it('groups findings correctly', () => {
			const code = '<?php eval($x); file_get_contents($url); phpinfo();';
			const findings = analyzePhpCode(code);
			const grouped = groupFindingsBySeverity(findings);

			expect(grouped.danger.some((f) => f.name === 'eval')).toBe(true);
			expect(
				grouped.warning.some((f) => f.name === 'file_get_contents')
			).toBe(true);
			expect(grouped.info.some((f) => f.name === 'phpinfo')).toBe(true);
		});
	});

	describe('case sensitivity', () => {
		it('detects functions regardless of case', () => {
			const findings = analyzePhpCode('<?php EVAL($code); System("ls");');
			expect(findings.some((f) => f.name.toLowerCase() === 'eval')).toBe(
				true
			);
			expect(
				findings.some((f) => f.name.toLowerCase() === 'system')
			).toBe(true);
		});
	});

	describe('comments are ignored', () => {
		it('does not flag functions in comments', () => {
			const findings = analyzePhpCode('<?php // eval($code); is bad');
			expect(findings.some((f) => f.name === 'eval')).toBe(false);
		});

		it('does not flag functions in block comments', () => {
			const findings = analyzePhpCode(
				'<?php /* system("ls"); */ echo 1;'
			);
			expect(findings.some((f) => f.name === 'system')).toBe(false);
		});
	});

	describe('strings are not function calls', () => {
		it('does not flag function names in strings', () => {
			const findings = analyzePhpCode('<?php $msg = "do not eval this";');
			expect(
				findings.some(
					(f) => f.type === 'function_call' && f.name === 'eval'
				)
			).toBe(false);
		});
	});
});
