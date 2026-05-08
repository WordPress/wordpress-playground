<?php
/**
 * Rewrites PHP 5.6+ variadic parameters and splat call sites.
 *
 * Variadics: `function foo($a, ...$rest)` becomes `function foo($a)`
 * with `$rest = array_slice(func_get_args(), N);` prepended to the
 * body. `N` is the number of fixed params before the splat. When
 * there are no fixed params we emit plain `func_get_args()` to avoid
 * an unnecessary slice.
 *
 * Splat calls: `fn($x, ...$rest)` becomes
 * `call_user_func_array($fn, array_merge(array($x), $rest))`, matching
 * the call form supported in PHP 5.2. Method calls use
 * `call_user_func_array(array($obj, 'method'), ...)`.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitorAbstract;

class VariadicAndSplatVisitor extends NodeVisitorAbstract
{
	public function enterNode(Node $node)
	{
		if (
			$node instanceof Stmt\Function_
			|| $node instanceof Stmt\ClassMethod
			|| $node instanceof Expr\Closure
			|| $node instanceof Expr\ArrowFunction
		) {
			$this->rewriteVariadic($node);
		}
		return null;
	}

	public function leaveNode(Node $node)
	{
		if ($node instanceof Expr\FuncCall) {
			return $this->rewriteSplatCall($node);
		}
		if ($node instanceof Expr\MethodCall) {
			return $this->rewriteSplatCall($node);
		}
		if ($node instanceof Expr\StaticCall) {
			return $this->rewriteSplatCall($node);
		}
		return null;
	}

	/**
	 * Converts trailing `...$rest` parameters into a
	 * `func_get_args()` slice injected at the start of the body.
	 */
	private function rewriteVariadic(Node $node): void
	{
		$params = $node->params ?? [];
		$fixed = [];
		$variadic = null;
		foreach ($params as $p) {
			if ($p->variadic) {
				$variadic = $p;
				continue;
			}
			$fixed[] = $p;
		}
		if ($variadic === null) {
			return;
		}
		$node->params = $fixed;
		$offset = count($fixed);
		$rhs = $offset === 0
			? new Expr\FuncCall(new Node\Name('func_get_args'))
			: new Expr\FuncCall(
				new Node\Name('array_slice'),
				[
					new Arg(new Expr\FuncCall(new Node\Name('func_get_args'))),
					new Arg(new Node\Scalar\Int_($offset)),
				]
			);
		$injected = new Stmt\Expression(
			new Expr\Assign($variadic->var, $rhs)
		);
		if (isset($node->stmts) && $node->stmts !== null) {
			array_unshift($node->stmts, $injected);
		}
	}

	/**
	 * Rewrites a call expression containing `...$rest` to use
	 * call_user_func_array.
	 */
	private function rewriteSplatCall(Node $node): ?Node
	{
		$args = $node->args;
		$splatIdx = null;
		foreach ($args as $idx => $arg) {
			if ($arg instanceof Arg && $arg->unpack) {
				$splatIdx = $idx;
				break;
			}
		}
		if ($splatIdx === null) {
			return null;
		}
		// We only handle the simple shape where `...` is the last arg.
		// Earlier positions (e.g. `f(...$a, $b)` or `f($a, ...$b, $c)`)
		// cannot be expressed via call_user_func_array without an
		// intermediate merged argument array and knowledge of all
		// subsequent splats — bail out loudly rather than silently
		// pass through and emit 5.6+ syntax.
		if ($splatIdx !== count($args) - 1) {
			$this->throwOnNonTrailingSplat($node, $args);
		}
		$fixed = array_slice($args, 0, $splatIdx);
		/** @var Arg $splatArg */
		$splatArg = $args[$splatIdx];
		$restExpr = $splatArg->value;

		// Build the arg-list expression: array_merge(array(fixed...), $rest).
		if (count($fixed) === 0) {
			$argsExpr = $restExpr;
		} else {
			$argsExpr = new Expr\FuncCall(
				new Node\Name('array_merge'),
				[
					new Arg(new Expr\Array_(array_map(
						fn(Arg $a) => new Node\ArrayItem($a->value),
						$fixed
					))),
					new Arg($restExpr),
				]
			);
		}

		$callable = $this->buildCallable($node);
		if ($callable === null) {
			// Unknown shape (e.g. variable function call). The builder
			// would need the raw callable, which we don't have.
			// call_user_func_array already accepts whatever the
			// original call supports.
			return null;
		}
		return new Expr\FuncCall(
			new Node\Name('call_user_func_array'),
			[new Arg($callable), new Arg($argsExpr)],
			$node->getAttributes()
		);
	}

	/**
	 * @param array<int, Arg|Node\VariadicPlaceholder> $args
	 * @return never
	 */
	private function throwOnNonTrailingSplat(Node $node, array $args): void
	{
		$line = $node->getStartLine();
		$shape = [];
		foreach ($args as $a) {
			if ($a instanceof Arg && $a->unpack) {
				$shape[] = '...';
			} else {
				$shape[] = 'arg';
			}
		}
		throw new \RuntimeException(sprintf(
			"VariadicAndSplatVisitor: non-trailing splat arguments are " .
			"not supported — saw call with args [%s] at line %d. " .
			"Rewrite the source to place `...` last, or pre-merge the " .
			"argument list into a single variable.",
			implode(', ', $shape),
			$line
		));
	}

	/** Returns the callable expression (first arg to call_user_func_array). */
	private function buildCallable(Node $node): ?Expr
	{
		if ($node instanceof Expr\FuncCall) {
			if ($node->name instanceof Node\Name) {
				return new Node\Scalar\String_($node->name->toString());
			}
			if ($node->name instanceof Expr) {
				return $node->name;
			}
			return null;
		}
		if ($node instanceof Expr\MethodCall) {
			$method = $node->name instanceof Node\Identifier
				? $node->name->toString()
				: null;
			if ($method === null) {
				return null;
			}
			return new Expr\Array_([
				new Node\ArrayItem($node->var),
				new Node\ArrayItem(new Node\Scalar\String_($method)),
			]);
		}
		if ($node instanceof Expr\StaticCall) {
			$method = $node->name instanceof Node\Identifier
				? $node->name->toString()
				: null;
			if ($method === null) {
				return null;
			}
			$cls = $node->class instanceof Node\Name
				? $node->class->toString()
				: null;
			if ($cls === null) {
				return null;
			}
			return new Expr\Array_([
				new Node\ArrayItem(new Node\Scalar\String_($cls)),
				new Node\ArrayItem(new Node\Scalar\String_($method)),
			]);
		}
		return null;
	}
}
