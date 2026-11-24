<?php
/**
 * Replaces `static::method()` / `static::$prop` / `static::CONST` with
 * their `self::` equivalents. This discards late static binding
 * semantics (added in PHP 5.3). The SQLite plugin's `static::` sites
 * don't rely on LSB for polymorphism — they're pseudo-constants
 * accessed from within their own class hierarchy.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class LateStaticBindingVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if (
			($node instanceof Expr\StaticCall
				|| $node instanceof Expr\StaticPropertyFetch
				|| $node instanceof Expr\ClassConstFetch)
			&& $node->class instanceof Node\Name
			&& $node->class->toString() === 'static'
		) {
			$node->class = new Node\Name('self', $node->class->getAttributes());
		}
		return null;
	}
}
