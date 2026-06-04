<?php
/**
 * Rewrites array access on the result of a function or method call.
 *
 *   fn()[0]              =>  _pg52_at(fn(), 0)
 *   $obj->method()['x']  =>  _pg52_at($obj->method(), 'x')
 *
 * PHP 5.4 added direct array dereferencing of call expressions;
 * PHP 5.2 requires the intermediate value to be assigned to a
 * variable before it can be indexed. We route it through a helper
 * function `_pg52_at($arr, $idx)` that returns the element or `null`.
 *
 * The helper is emitted once per file that uses it by the Closure
 * hoisting visitor's trailing helper block. (In practice we emit it
 * unconditionally as a guarded `function_exists` wrapper so files
 * that don't use it still get the definition — cheap and easy.)
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class ArrayDerefOnCallVisitor extends NodeVisitorAbstract
{
	/** @var bool */
	public bool $used = false;

	public function leaveNode(Node $node)
	{
		if (!$node instanceof Expr\ArrayDimFetch) {
			return null;
		}
		if ($node->dim === null) {
			return null;
		}
		$target = $node->var;
		if (
			!$target instanceof Expr\FuncCall
			&& !$target instanceof Expr\MethodCall
			&& !$target instanceof Expr\StaticCall
			&& !$target instanceof Expr\NullsafeMethodCall
			&& !$target instanceof Expr\New_
		) {
			return null;
		}
		$this->used = true;
		return new Expr\FuncCall(
			new Node\Name('_pg52_at'),
			[
				new Arg($target),
				new Arg($node->dim),
			],
			$node->getAttributes()
		);
	}
}
