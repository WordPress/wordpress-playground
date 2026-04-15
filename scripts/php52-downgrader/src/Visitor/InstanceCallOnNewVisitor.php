<?php
/**
 * Rewrites member access on a `new` expression.
 *
 * PHP 5.4+ supports `(new Foo($a))->bar(...)` and `(new Foo($a))->prop`
 * directly. PHP 5.2 does not — the parser refuses to chain a member
 * access onto the `new` expression. We rewrite each occurrence to a
 * small runtime helper:
 *
 *   (new Foo($a))->bar($b)  =>  _pg52_call(new Foo($a), 'bar', array($b))
 *   (new Foo($a))->prop     =>  _pg52_get(new Foo($a), 'prop')
 *
 * The helpers themselves are emitted by the closure hoisting visitor's
 * trailing helper block, via {@see HelperEmitterVisitor}. When the
 * downgraded plugin doesn't hit either of these shapes the helpers
 * stay out of the output.
 *
 * The visitor records which helpers were used so the hoister knows
 * which definitions to append.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class InstanceCallOnNewVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if ($node instanceof Expr\MethodCall && $node->var instanceof Expr\New_) {
			$method = $node->name instanceof Node\Identifier
				? new Node\Scalar\String_($node->name->toString())
				: $node->name;
			$argsArr = new Expr\Array_(array_map(
				fn(Arg $a) => new Node\ArrayItem($a->value),
				$node->args
			));
			return new Expr\FuncCall(
				new Node\Name('_pg52_call'),
				[
					new Arg($node->var),
					new Arg($method),
					new Arg($argsArr),
				],
				$node->getAttributes()
			);
		}
		if ($node instanceof Expr\PropertyFetch && $node->var instanceof Expr\New_) {
			$prop = $node->name instanceof Node\Identifier
				? new Node\Scalar\String_($node->name->toString())
				: $node->name;
			return new Expr\FuncCall(
				new Node\Name('_pg52_get'),
				[
					new Arg($node->var),
					new Arg($prop),
				],
				$node->getAttributes()
			);
		}
		return null;
	}
}
