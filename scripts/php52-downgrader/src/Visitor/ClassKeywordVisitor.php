<?php
/**
 * Rewrites the PHP 5.5+ `::class` magic constant.
 *
 *   Foo::class            =>  'Foo'
 *   self::class           =>  get_class()
 *   static::class         =>  get_called_class()
 *
 * `get_class()` called without arguments returns the name of the
 * class in which the call is made — equivalent to `self::class` in
 * the method scopes where the SQLite plugin uses it. Outside a method
 * the output is nonsense, but the upstream plugin never uses
 * `self::class` at class body scope.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class ClassKeywordVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if (!$node instanceof Expr\ClassConstFetch) {
			return null;
		}
		if (!$node->name instanceof Node\Identifier) {
			return null;
		}
		if ($node->name->name !== 'class') {
			return null;
		}
		if ($node->class instanceof Node\Name) {
			$name = $node->class->toString();
			if ($name === 'self') {
				return new Expr\FuncCall(new Node\Name('get_class'));
			}
			if ($name === 'static') {
				return new Expr\FuncCall(new Node\Name('get_called_class'));
			}
			return new Node\Scalar\String_($name, $node->getAttributes());
		}
		return null;
	}
}
