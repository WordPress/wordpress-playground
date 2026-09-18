<?php
/**
 * Rewrites `a ** b` to `pow(a, b)`. PHP 5.6 added the exponent
 * operator; PHP 5.2 only has `pow()`.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class ExponentVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if ($node instanceof Expr\BinaryOp\Pow) {
			return new Expr\FuncCall(
				new Node\Name('pow'),
				[new Arg($node->left), new Arg($node->right)],
				$node->getAttributes()
			);
		}
		if ($node instanceof Expr\AssignOp\Pow) {
			return new Expr\Assign(
				$node->var,
				new Expr\FuncCall(
					new Node\Name('pow'),
					[new Arg(clone $node->var), new Arg($node->expr)]
				),
				$node->getAttributes()
			);
		}
		return null;
	}
}
