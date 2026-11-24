<?php
/**
 * Rewrites PHP 8 nullsafe operator `$a?->b`.
 *
 * For plain isset-safe receivers we emit a direct
 * `(isset($a) ? $a->b : null)` ternary. For side-effecting receivers
 * (function/method calls, chained nullsafe rewrites, ternaries, etc.)
 * we hoist into a temp var:
 *
 *     (($__pg_ns_0 = $expr) !== null ? $__pg_ns_0->b : null)
 *
 * This is necessary for chained `$a?->b?->c`: the inner rewrite
 * produces a ternary, which cannot legally appear inside `isset()`.
 * Counter-suffixed temp names avoid collisions in nested chains.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class NullsafeVisitor extends NodeVisitorAbstract
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
		if ($node instanceof Expr\NullsafePropertyFetch) {
			return $this->rewriteNullsafe(
				$node->var,
				fn(Expr $receiver) => new Expr\PropertyFetch($receiver, $node->name)
			);
		}
		if ($node instanceof Expr\NullsafeMethodCall) {
			return $this->rewriteNullsafe(
				$node->var,
				fn(Expr $receiver) => new Expr\MethodCall($receiver, $node->name, $node->args)
			);
		}
		return null;
	}

	/**
	 * Builds the lowered ternary. If the receiver is isset-safe we use
	 * the direct `isset($x) ? $x->y : null` form; otherwise we capture
	 * it in a unique temp var and null-compare.
	 */
	private function rewriteNullsafe(Expr $receiver, \Closure $buildAccess): Expr\Ternary
	{
		if ($this->isIssetSafe($receiver)) {
			return new Expr\Ternary(
				new Expr\Isset_([$receiver]),
				$buildAccess($receiver),
				$this->nullLit()
			);
		}
		$tmpName = '__pg_ns_' . $this->tempCounter++;
		$tmp = new Expr\Variable($tmpName);
		$assign = new Expr\Assign($tmp, $receiver);
		$notNull = new Expr\BinaryOp\NotIdentical(
			$assign,
			$this->nullLit()
		);
		return new Expr\Ternary(
			$notNull,
			$buildAccess(clone $tmp),
			$this->nullLit()
		);
	}

	/**
	 * Returns true when the expression is safe to appear inside an
	 * `isset()` call. Matches NullCoalescingVisitor::isIssetSafe.
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
			return $this->isIssetSafe($expr->var);
		}
		return false;
	}

	private function nullLit(): Expr\ConstFetch
	{
		return new Expr\ConstFetch(new Node\Name('null'));
	}
}
