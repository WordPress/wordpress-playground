<?php
/**
 * Strips PHP 8+ `#[Attribute]` groups and PHP 7.0+ `declare(strict_types=1);`
 * statements. Neither construct parses on PHP 5.2.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitor;
use PhpParser\NodeVisitorAbstract;

class AttributeAndDeclareStripVisitor extends NodeVisitorAbstract
{
	public function enterNode(Node $node)
	{
		if (
			$node instanceof Stmt\ClassLike
			|| $node instanceof Stmt\ClassMethod
			|| $node instanceof Stmt\Function_
			|| $node instanceof Stmt\Property
			|| $node instanceof Stmt\EnumCase
			|| $node instanceof Stmt\ClassConst
			|| $node instanceof Node\Param
			|| $node instanceof Node\Expr\Closure
			|| $node instanceof Node\Expr\ArrowFunction
		) {
			// attrGroups is defined on any node that can be annotated.
			if (property_exists($node, 'attrGroups')) {
				$node->attrGroups = [];
			}
		}
		return null;
	}

	public function leaveNode(Node $node)
	{
		if ($node instanceof Stmt\Declare_) {
			// Drop declare(strict_types=1); entirely. Leave non-
			// strict_types declares alone (ticks, etc).
			foreach ($node->declares as $decl) {
				if (
					$decl->key instanceof Node\Identifier
					&& $decl->key->name === 'strict_types'
				) {
					return NodeVisitor::REMOVE_NODE;
				}
			}
		}
		return null;
	}
}
