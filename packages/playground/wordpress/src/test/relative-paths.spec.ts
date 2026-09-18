import { rewriteRelativePhpIncludes } from '../legacy-wp/relative-paths';

describe('Legacy WordPress relative path rewrites', () => {
	it('rewrites parent and current-directory includes', () => {
		const rewritten = rewriteRelativePhpIncludes(`<?php
require_once('../wp-load.php');
include("./b2header.php");
`);

		expect(rewritten).toContain(
			"require_once(dirname(dirname(__FILE__)) . '/wp-load.php')"
		);
		expect(rewritten).toContain(
			"include(dirname(__FILE__) . '/b2header.php')"
		);
	});

	it('rewrites bare PHP filenames in function and statement forms', () => {
		const rewritten = rewriteRelativePhpIncludes(`<?php
require_once('admin.php');
include 'admin-footer.php';
`);

		expect(rewritten).toContain(
			"require_once(dirname(__FILE__) . '/admin.php')"
		);
		expect(rewritten).toContain(
			"include(dirname(__FILE__) . '/admin-footer.php')"
		);
	});

	it('leaves identifiers that merely end in require/include alone', () => {
		const source = `<?php
my_require_once('admin.php');
foo_include('../setup.php');
`;

		expect(rewriteRelativePhpIncludes(source)).toBe(source);
	});

	it('keeps non-PHP include paths unchanged', () => {
		const source = `<?php
$menu = file('./menu.txt');
require_once(WPINC . '/functions.php');
`;

		expect(rewriteRelativePhpIncludes(source)).toBe(source);
	});
});
