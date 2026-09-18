<?php
/**
 * PHP 5.2 pretty printer.
 *
 * Extends {@see \PhpParser\PrettyPrinter\Standard} and forces the few
 * settings that differ between PHP 5.2 and the parser's oldest
 * officially-supported emit target (7.0):
 *
 *   * Always uses `array(...)` — PHP 5.2 has no short array literal.
 *   * Emits `dirname(__FILE__)` instead of `__DIR__` — the
 *     {@see Visitor\DirConstantVisitor} rewrites the constant to an
 *     {@see \PhpParser\Node\Expr\FuncCall}, but we also install a safety
 *     net here in case a stray node slips through.
 *   * Targets PHP 7.0 so trailing commas in parameter lists and the
 *     PHP 8 "new without parentheses" dereferencing are emitted in
 *     their conservative form.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Scalar\MagicConst;
use PhpParser\PhpVersion;
use PhpParser\PrettyPrinter\Standard;

class PrettyPrinter extends Standard
{
	public function __construct()
	{
		parent::__construct([
			'phpVersion' => PhpVersion::fromComponents(7, 0),
			'shortArraySyntax' => false,
		]);
	}

	protected function pExpr_Array(Expr\Array_ $node): string
	{
		// The parser tags the array with its source-text kind
		// (SHORT vs LONG). The Standard printer honors that attribute
		// instead of the `shortArraySyntax` constructor option, so an
		// input `[]` stays `[]` on output. Force LONG syntax here.
		$items = $this->pMaybeMultiline($node->items, true);
		return 'array(' . $items . ')';
	}

	protected function pScalar_MagicConst_Dir(MagicConst\Dir $node): string
	{
		return 'dirname(__FILE__)';
	}
}
