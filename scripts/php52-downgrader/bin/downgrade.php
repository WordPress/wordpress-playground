#!/usr/bin/env php
<?php
/**
 * PHP 7+ -> PHP 5.2 downgrader entrypoint.
 *
 * Walks every `.php` (and `.copy`) file under the given directory and
 * rewrites it in place using an AST-based pipeline built on top of
 * nikic/php-parser v5.
 *
 * Usage:
 *   php scripts/php52-downgrader/bin/downgrade.php <input-dir> [--output=<dir>]
 *
 * Exits with a non-zero status if any file fails to parse, transform,
 * or pretty-print.
 */

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use WpPlayground\Php52Downgrader\Downgrader;

$argv = $_SERVER['argv'];
array_shift($argv);

$inputDir = null;
$outputDir = null;
foreach ($argv as $arg) {
	if (strpos($arg, '--output=') === 0) {
		$outputDir = substr($arg, strlen('--output='));
	} elseif ($inputDir === null) {
		$inputDir = $arg;
	}
}

if ($inputDir === null) {
	fwrite(STDERR, "usage: downgrade.php <input-dir> [--output=<dir>]\n");
	exit(2);
}
if (!is_dir($inputDir)) {
	fwrite(STDERR, "error: input directory not found: {$inputDir}\n");
	exit(2);
}

$downgrader = new Downgrader();

$failures = [];
$patched = 0;
$total = 0;

// Collect every file path up front so we can run two passes in a
// stable order. Pass 1 = discovery (which class constants will be
// promoted to static props anywhere in the project); pass 2 = full
// downgrade with the cross-file registry available.
$allFiles = [];
$iter = new RecursiveIteratorIterator(
	new RecursiveDirectoryIterator($inputDir, FilesystemIterator::SKIP_DOTS)
);
foreach ($iter as $fileInfo) {
	/** @var SplFileInfo $fileInfo */
	if (!$fileInfo->isFile()) {
		continue;
	}
	$name = $fileInfo->getFilename();
	if (!preg_match('/\.(php|copy)$/', $name)) {
		continue;
	}
	$allFiles[] = $fileInfo->getPathname();
}
sort($allFiles);

// Pass 1: cross-file hoisted-constant discovery. Walks the AST with
// only the namespace-strip + ArrayClassConstantVisitor so the
// downgrader knows every `Foo::CONST` reference that file B will
// need rewritten to `Foo::$CONST` (where `Foo` was promoted in file
// A). Skipped files (parse errors etc.) propagate to pass 2 so the
// developer sees the error there.
foreach ($allFiles as $path) {
	$rel = ltrim(substr($path, strlen($inputDir)), '/');
	$source = @file_get_contents($path);
	if ($source === false) {
		continue;
	}
	try {
		$downgrader->collectHoistedConsts($source);
	} catch (Throwable $e) {
		// Defer the error to pass 2 so the file shows up in the
		// failures list with a real downgrade-context message.
	}
}

foreach ($allFiles as $path) {
	$total++;
	$rel = ltrim(substr($path, strlen($inputDir)), '/');
	try {
		$source = file_get_contents($path);
		if ($source === false) {
			throw new RuntimeException("unreadable file");
		}
		$result = $downgrader->downgrade($source, $rel);
		if ($outputDir !== null) {
			$destPath = rtrim($outputDir, '/') . '/' . $rel;
			@mkdir(dirname($destPath), 0777, true);
			file_put_contents($destPath, $result);
		} else {
			if ($result !== $source) {
				file_put_contents($path, $result);
				$patched++;
			}
		}
	} catch (Throwable $e) {
		$failures[] = "{$rel}: " . $e->getMessage();
		fwrite(STDERR, "FAIL {$rel}: " . $e->getMessage() . "\n");
	}
}

fwrite(STDOUT, "downgraded {$patched}/{$total} files\n");

if ($failures) {
	fwrite(STDERR, "\n" . count($failures) . " file(s) failed.\n");
	exit(1);
}
exit(0);
