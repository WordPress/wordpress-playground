<?php
/**
 * `__DIR__` (PHP 5.3+) -> `dirname(__FILE__)`.
 *
 * The pretty printer subclass {@see \WpPlayground\Php52Downgrader\PrettyPrinter}
 * already emits `dirname(__FILE__)` in place of the magic constant, so
 * most files are handled there. This visitor is kept as a separate
 * pass because it lets later visitors see a concrete function call
 * instead of a magic constant — notably {@see ArrayClassConstantVisitor}
 * needs to recognize that `__DIR__ . 'x'` is a non-constant expression
 * and hoist the const.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class DirConstantVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if ($node instanceof Node\Scalar\MagicConst\Dir) {
			return new Expr\FuncCall(
				new Node\Name('dirname'),
				[new Arg(new Node\Scalar\MagicConst\File($node->getAttributes()))],
				$node->getAttributes()
			);
		}
		return null;
	}
}
