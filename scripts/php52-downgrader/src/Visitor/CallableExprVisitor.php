<?php
/**
 * Rewrites invocations where the callable is a complex expression.
 *
 *   ($obj->callback)($args)   =>  call_user_func($obj->callback, $args)
 *   ($var)($args)             =>  call_user_func($var, $args)  (dropped — $var($args) works on 5.2)
 *   (($a) ? $b : $c)($args)   =>  call_user_func(($a) ? $b : $c, $args)
 *
 * PHP 5.4 added the ability to chain a call onto any expression. PHP
 * 5.2 supports only named function calls (`foo()`), method calls
 * (`$obj->foo()`), and calling a string-valued variable as a bare
 * function (`$var()`). Everything else must go through
 * `call_user_func()` / `call_user_func_array()`.
 *
 * We recognize a call expression as "complex" when the `name` on the
 * FuncCall node is neither a Name (named function) nor a plain
 * Variable (the PHP 5.2 `$var()` shape). That covers callable
 * property fetches, array dim fetches, ternaries, and so on.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\NodeVisitorAbstract;

class CallableExprVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if (!$node instanceof Expr\FuncCall) {
			return null;
		}
		$name = $node->name;
		if ($name instanceof Node\Name) {
			return null;
		}
		if ($name instanceof Expr\Variable) {
			// $var($args) is valid on PHP 5.2 when $var is a string.
			return null;
		}
		// Everything else becomes call_user_func(expr, args...).
		$newArgs = [new Arg($name)];
		foreach ($node->args as $arg) {
			$newArgs[] = $arg;
		}
		return new Expr\FuncCall(
			new Node\Name('call_user_func'),
			$newArgs,
			$node->getAttributes()
		);
	}
}
