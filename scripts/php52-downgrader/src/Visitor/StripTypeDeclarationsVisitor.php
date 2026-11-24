<?php
/**
 * Strips PHP 7.0+ type declarations.
 *
 * Clears parameter type hints, return type declarations, and typed
 * property declarations. PHP 5.2 has no syntax for any of these.
 *
 * Typed properties (PHP 7.4+) get their `type` field cleared. The
 * upstream printer then emits the property as a plain `public $x`
 * declaration.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitorAbstract;

class StripTypeDeclarationsVisitor extends NodeVisitorAbstract
{
	public function enterNode(Node $node)
	{
		if ($node instanceof Node\Param) {
			$node->type = null;
			return null;
		}
		if ($node instanceof Stmt\Function_ || $node instanceof Stmt\ClassMethod) {
			$node->returnType = null;
			return null;
		}
		if ($node instanceof Node\Expr\Closure || $node instanceof Node\Expr\ArrowFunction) {
			$node->returnType = null;
			return null;
		}
		if ($node instanceof Stmt\Property) {
			$node->type = null;
			return null;
		}
		return null;
	}
}
