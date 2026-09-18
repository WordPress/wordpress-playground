<?php
/**
 * Rewrites the PHP 5.3+ short ternary `a ?: b`.
 *
 *   $var ?: $fallback               =>  $var ? $var : $fallback
 *   $safe->expr ?: $fallback        =>  $safe->expr ? $safe->expr : $fallback
 *   fn($a) ?: $fallback             =>  (($__pg_st_tmp = fn($a)) ? $__pg_st_tmp : $fallback)
 *
 * Simple side-effect-free LHSes are duplicated in place. Complex
 * LHSes are captured in a temp var so they evaluate once.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class ShortTernaryVisitor extends NodeVisitorAbstract
{
	/** @var int Counter for unique temp var names, reset per file. */
	private int $tempCounter = 0;

	public function beforeTraverse(array $nodes)
	{
		$this->tempCounter = 0;
		return null;
	}

	public function leaveNode(Node $node)
	{
		if (!$node instanceof Expr\Ternary) {
			return null;
		}
		if ($node->if !== null) {
			// Not a short ternary.
			return null;
		}
		$lhs = $node->cond;
		if ($this->isDuplicatable($lhs)) {
			return new Expr\Ternary(
				$lhs,
				clone $lhs,
				$node->else,
				$node->getAttributes()
			);
		}
		// Side-effecting LHS: capture in a counter-suffixed temp var
		// so nested `a() ?: b() ?: c()` rewrites don't collide.
		$tmpName = '__pg_st_tmp_' . $this->tempCounter++;
		$tmp = new Expr\Variable($tmpName);
		$assign = new Expr\Assign($tmp, $lhs);
		return new Expr\Ternary(
			$assign,
			clone $tmp,
			$node->else,
			$node->getAttributes()
		);
	}

	private function isDuplicatable(Node\Expr $expr): bool
	{
		if ($expr instanceof Expr\Variable) {
			return true;
		}
		if ($expr instanceof Expr\PropertyFetch) {
			return $this->isDuplicatable($expr->var);
		}
		if ($expr instanceof Expr\StaticPropertyFetch) {
			return true;
		}
		if ($expr instanceof Expr\ArrayDimFetch) {
			return $this->isDuplicatable($expr->var);
		}
		if ($expr instanceof Expr\ConstFetch) {
			return true;
		}
		if ($expr instanceof Expr\ClassConstFetch) {
			return true;
		}
		if ($expr instanceof Node\Scalar) {
			return true;
		}
		return false;
	}
}
