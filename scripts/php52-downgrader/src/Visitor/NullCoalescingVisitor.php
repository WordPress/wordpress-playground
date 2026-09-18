<?php
/**
 * Rewrites the PHP 7.0+ null-coalescing operator `a ?? b`.
 *
 * Strategy:
 *   * If the left operand is a "simple" expression (variable, property
 *     fetch, array dim fetch, static property fetch, class constant
 *     array access) we emit `isset(LHS) ? LHS : RHS`.
 *   * Otherwise we emit a self-assigning temp var expression:
 *     `(($__pg_nc = LHS) !== null ? $__pg_nc : RHS)`. This is needed
 *     for function/method calls, ternary results, etc. — anything
 *     that can't appear inside `isset()`.
 *
 * The `isset()` variant is preferred because it doesn't introduce a
 * temporary and mirrors the most common pattern in the SQLite plugin.
 *
 * `??=` (the PHP 7.4 null-coalescing assignment) is a separate node
 * type. We lower it to `$lhs = $lhs ?? $rhs` before the general
 * rewrite, so the standard `??` handling takes care of both cases.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class NullCoalescingVisitor extends NodeVisitorAbstract
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
		if ($node instanceof Expr\AssignOp\Coalesce) {
			// $x ??= $y: cloning the LHS is only safe when the LHS is a
			// trivially duplicatable l-value. For anything else (e.g.
			// `$obj->method()->prop ??= ...`) duplicating would double-
			// evaluate the receiver chain. We bail out loudly rather
			// than silently miscompile — the SQLite plugin currently
			// doesn't use `??=` on complex LHS.
			if (!$this->isAssignTargetDuplicatable($node->var)) {
				throw new \RuntimeException(
					'NullCoalescingVisitor: `??=` on a complex LHS is not ' .
					'supported (would double-evaluate side effects). ' .
					'Rewrite the source to use an intermediate variable.'
				);
			}
			return new Expr\Assign(
				$node->var,
				new Expr\BinaryOp\Coalesce(
					clone $node->var,
					$node->expr,
					$node->getAttributes()
				),
				$node->getAttributes()
			);
		}
		if (!$node instanceof Expr\BinaryOp\Coalesce) {
			return null;
		}
		$lhs = $node->left;
		$rhs = $node->right;
		if ($this->isIssetSafe($lhs)) {
			return new Expr\Ternary(
				new Expr\Isset_([$lhs]),
				$lhs,
				$rhs,
				$node->getAttributes()
			);
		}
		// Side-effecting LHS: capture in a temp var. Use a counter-
		// suffixed name so nested `??` rewrites don't clobber each
		// other (e.g. `a() ?? b() ?? c()`).
		$tmpName = '__pg_nc_tmp_' . $this->tempCounter++;
		$tmp = new Expr\Variable($tmpName);
		$assign = new Expr\Assign($tmp, $lhs);
		$notNull = new Expr\BinaryOp\NotIdentical(
			$assign,
			new Expr\ConstFetch(new Node\Name('null'))
		);
		return new Expr\Ternary($notNull, clone $tmp, $rhs, $node->getAttributes());
	}

	/**
	 * Returns true when the expression is a trivially duplicatable
	 * l-value: a simple Variable, a simple array-dim fetch on such,
	 * or a property fetch on a simple Variable. Anything else may
	 * have side effects that must not be evaluated twice.
	 */
	private function isAssignTargetDuplicatable(Node\Expr $expr): bool
	{
		if ($expr instanceof Expr\Variable) {
			return true;
		}
		if ($expr instanceof Expr\PropertyFetch) {
			return $expr->var instanceof Expr\Variable;
		}
		if ($expr instanceof Expr\StaticPropertyFetch) {
			return true;
		}
		if ($expr instanceof Expr\ArrayDimFetch) {
			return $this->isAssignTargetDuplicatable($expr->var);
		}
		return false;
	}

	/**
	 * Returns true when the expression is safe to appear inside an
	 * `isset()` call (i.e. PHP won't raise E_NOTICE at parse time).
	 */
	private function isIssetSafe(Node\Expr $expr): bool
	{
		if ($expr instanceof Expr\Variable) {
			return true;
		}
		if ($expr instanceof Expr\PropertyFetch) {
			return $this->isIssetSafe($expr->var);
		}
		if ($expr instanceof Expr\StaticPropertyFetch) {
			return true;
		}
		if ($expr instanceof Expr\ArrayDimFetch) {
			return $expr->var instanceof Expr\Variable
				|| $expr->var instanceof Expr\PropertyFetch
				|| $expr->var instanceof Expr\StaticPropertyFetch
				|| $expr->var instanceof Expr\ArrayDimFetch
				|| $expr->var instanceof Expr\ClassConstFetch;
		}
		return false;
	}
}
