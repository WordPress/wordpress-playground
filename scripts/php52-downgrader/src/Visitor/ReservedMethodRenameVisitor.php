<?php
/**
 * Renames methods whose name is a reserved keyword on PHP 5.2 (and
 * earlier). The only case we actually hit in the SQLite plugin is a
 * method called `throw`, which clashes with the `throw` statement on
 * every PHP version. Rename to `throwError` and update all call
 * sites within the file.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitorAbstract;

class ReservedMethodRenameVisitor extends NodeVisitorAbstract
{
	/** Old name => new name. */
	private const RENAMES = [
		'throw' => 'throwError',
	];

	public function enterNode(Node $node)
	{
		if ($node instanceof Stmt\ClassMethod && isset(self::RENAMES[$node->name->name])) {
			$node->name = new Node\Identifier(self::RENAMES[$node->name->name]);
			return null;
		}
		if ($node instanceof Expr\MethodCall && $node->name instanceof Node\Identifier
			&& isset(self::RENAMES[$node->name->name])) {
			$node->name = new Node\Identifier(self::RENAMES[$node->name->name]);
			return null;
		}
		if ($node instanceof Expr\StaticCall && $node->name instanceof Node\Identifier
			&& isset(self::RENAMES[$node->name->name])) {
			$node->name = new Node\Identifier(self::RENAMES[$node->name->name]);
			return null;
		}
		return null;
	}
}
