<?php
/**
 * Hoists PHP 5.3+ closures (`function () { ... }` and
 * `fn (...) => ...`) into top-level named functions.
 *
 * PHP 5.2 has no closures at all. For each `Expr\Closure` or
 * `Expr\ArrowFunction` node we:
 *
 *   1. Generate a deterministic, file-unique helper name based on a
 *      hash of the file path plus the closure's source order.
 *   2. Build a top-level `Stmt\Function_` carrying the closure's
 *      parameter list and body, prepended with `$captured = $GLOBALS[...]`
 *      reads for each captured variable (`use` clause entries plus
 *      an implicit `$__pg_this` when the body references `$this`).
 *   3. Replace the closure expression with a small setter-call
 *      expression:
 *
 *          _pg52_set_capture('helper_name', array(
 *              'cap1' => $cap1,
 *              '__pg_this' => $this,
 *              ...
 *          ))
 *
 *      which, at runtime, stashes the captures in $GLOBALS and returns
 *      the helper name. PHP 5.2 lets you call a function via
 *      `$var()` when `$var` is a string, so subsequent invocations of
 *      the returned name work transparently.
 *
 *   4. If the closure had no captures and no `$this` reference, skip
 *      the setter entirely and emit a bare string literal instead.
 *
 *   5. Append the helper function (and the capture setter helper, and
 *      the `(new X())->y` helpers if used) to the end of the file so
 *      they are available by the time the returned name is invoked.
 *
 * `$this` handling: when the body uses `$this`, we rename every
 * `$this` reference inside the closure body to `$__pg_this`, add
 * `$__pg_this` to the capture map, and emit the helper as an
 * ordinary function that unpacks `$__pg_this` from $GLOBALS. This
 * loses access to private/protected members of the enclosing class,
 * so the AST pipeline also runs `PromoteForHoistedClosuresVisitor`
 * to widen affected members to public in files that contain
 * closures referencing `$this`.
 *
 * `Closure::fromCallable()`, `Closure::bind()`, and explicit static
 * closures (`static function () {}`) are downgraded the same way.
 * The `static` keyword is dropped because a hoisted top-level
 * function has no $this by default on 5.2.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Modifiers;
use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

class ClosureHoistingVisitor extends NodeVisitorAbstract
{
	/** @var string */
	private string $relPath;

	/** @var string */
	private string $fileSlug;

	/** @var int */
	private int $counter = 0;

	/** @var Stmt\Function_[] */
	private array $helpers = [];

	/** @var bool */
	private bool $hadThisClosures = false;

	/** @var bool */
	private bool $needsCaptureHelper = false;

	/**
	 * Stack of (className, parentName) pairs for the classes we are
	 * currently inside. Pushed in enterNode for Stmt\Class_, popped in
	 * leaveNode. The top of the stack tells us which class scope a
	 * closure being hoisted came from — needed because hoisting moves
	 * the body to top-level scope where `self::`/`parent::`/`static::`
	 * become fatal errors.
	 *
	 * @var array<int, array{class: string, parent: string|null}>
	 */
	private array $classStack = [];

	public function __construct(string $relPath)
	{
		$this->relPath = $relPath;
		$this->fileSlug = $this->slugify($relPath);
	}

	public function beforeTraverse(array $nodes)
	{
		$this->counter = 0;
		$this->helpers = [];
		$this->hadThisClosures = false;
		$this->needsCaptureHelper = false;
		$this->classStack = [];
		return null;
	}

	public function enterNode(Node $node)
	{
		if ($node instanceof Stmt\Class_) {
			$this->classStack[] = [
				'class' => $node->name !== null ? $node->name->toString() : '',
				'parent' => $node->extends !== null ? $node->extends->toString() : null,
			];
		}
		return null;
	}

	public function leaveNode(Node $node)
	{
		if ($node instanceof Stmt\Class_) {
			array_pop($this->classStack);
			return null;
		}
		if ($node instanceof Expr\ArrowFunction) {
			// Convert arrow function to a regular closure first.
			// Arrow functions auto-capture all used variables by value;
			// the outer pass then hoists them. We do it in two steps so
			// that the variable collection logic only has to handle
			// one node type.
			$body = [new Stmt\Return_($node->expr)];
			$uses = $this->collectArrowCaptures($node->expr, $node->params);
			$closure = new Expr\Closure([
				'static' => $node->static,
				'byRef' => false,
				'params' => $node->params,
				'uses' => $uses,
				'returnType' => null,
				'stmts' => $body,
			], $node->getAttributes());
			return $this->hoistClosure($closure);
		}
		if ($node instanceof Expr\Closure) {
			return $this->hoistClosure($node);
		}
		return null;
	}

	public function afterTraverse(array $nodes)
	{
		$trailing = [];
		// Always emit the runtime helper shims — they're cheap,
		// guarded by function_exists, and it means downstream
		// visitors don't need to coordinate on who "owns" a helper.
		$trailing[] = $this->buildRuntimeHelperBlock();
		if ($this->needsCaptureHelper) {
			$trailing[] = $this->buildCaptureHelperWrapper();
		}
		foreach ($this->helpers as $helper) {
			$trailing[] = $this->wrapInFunctionExistsGuard($helper);
		}
		return array_merge($nodes, $trailing);
	}

	/**
	 * Returns a single If_ node that conditionally defines all of the
	 * fixed runtime helpers (_pg52_at, _pg52_call, _pg52_get). The
	 * block is emitted verbatim into every file; the guards ensure
	 * multiple-include is safe.
	 */
	private function buildRuntimeHelperBlock(): Stmt\If_
	{
		$cond = new Expr\BooleanNot(
			new Expr\FuncCall(
				new Node\Name('function_exists'),
				[new Arg(new Node\Scalar\String_('_pg52_at'))]
			)
		);
		return new Stmt\If_(
			$cond,
			[
				'stmts' => [
					$this->buildAtHelper(),
					$this->buildCallHelper(),
					$this->buildGetHelper(),
				],
			]
		);
	}

	/**
	 * `function _pg52_at($arr, $idx) { return (is_array($arr) && array_key_exists($idx, $arr)) ? $arr[$idx] : null; }`
	 */
	private function buildAtHelper(): Stmt\Function_
	{
		$arr = new Expr\Variable('arr');
		$idx = new Expr\Variable('idx');
		$cond = new Expr\BinaryOp\BooleanAnd(
			new Expr\FuncCall(new Node\Name('is_array'), [new Arg($arr)]),
			new Expr\FuncCall(
				new Node\Name('array_key_exists'),
				[new Arg($idx), new Arg($arr)]
			)
		);
		$true = new Expr\ArrayDimFetch($arr, $idx);
		$false = new Expr\ConstFetch(new Node\Name('null'));
		return new Stmt\Function_(
			'_pg52_at',
			[
				'byRef' => false,
				'params' => [new Node\Param($arr), new Node\Param($idx)],
				'returnType' => null,
				'stmts' => [
					new Stmt\Return_(new Expr\Ternary($cond, $true, $false)),
				],
			]
		);
	}

	/**
	 * `function _pg52_call($obj, $method, $args) { return call_user_func_array(array($obj, $method), $args); }`
	 */
	private function buildCallHelper(): Stmt\Function_
	{
		$obj = new Expr\Variable('obj');
		$method = new Expr\Variable('method');
		$args = new Expr\Variable('args');
		$pair = new Expr\Array_([
			new Node\ArrayItem($obj),
			new Node\ArrayItem($method),
		]);
		$call = new Expr\FuncCall(
			new Node\Name('call_user_func_array'),
			[new Arg($pair), new Arg($args)]
		);
		return new Stmt\Function_(
			'_pg52_call',
			[
				'byRef' => false,
				'params' => [
					new Node\Param($obj),
					new Node\Param($method),
					new Node\Param($args),
				],
				'returnType' => null,
				'stmts' => [new Stmt\Return_($call)],
			]
		);
	}

	/**
	 * `function _pg52_get($obj, $prop) { return $obj->{$prop}; }`
	 */
	private function buildGetHelper(): Stmt\Function_
	{
		$obj = new Expr\Variable('obj');
		$prop = new Expr\Variable('prop');
		return new Stmt\Function_(
			'_pg52_get',
			[
				'byRef' => false,
				'params' => [new Node\Param($obj), new Node\Param($prop)],
				'returnType' => null,
				'stmts' => [
					new Stmt\Return_(new Expr\PropertyFetch($obj, $prop)),
				],
			]
		);
	}

	public function hadThisClosures(): bool
	{
		return $this->hadThisClosures;
	}

	// ─────────────────────────────────────────────────────────────
	// Hoisting core
	// ─────────────────────────────────────────────────────────────

	private function hoistClosure(Expr\Closure $closure): Node
	{
		// By-reference captures (`use (&$x)`) cannot be faithfully
		// emulated by a top-level hoisted helper: the helper reads
		// captures from $GLOBALS, which loses the reference binding
		// back to the caller's scope. Silently converting to by-value
		// would be a semantic miscompile, so bail out loudly and let
		// the operator rewrite the source.
		foreach ($closure->uses as $use) {
			if ($use->byRef) {
				$varName = $use->var instanceof Expr\Variable && is_string($use->var->name)
					? $use->var->name
					: '?';
				throw new \RuntimeException(sprintf(
					"ClosureHoistingVisitor: cannot hoist closure with " .
					"by-reference capture 'use (&\$%s)' in %s",
					$varName,
					$this->relPath
				));
			}
		}
		$this->counter++;
		$helperName = sprintf(
			'_wp_pg52_%s_closure_%d',
			$this->fileSlug,
			$this->counter
		);
		// CRITICAL: a closure's body may reference `self::CONST`,
		// `parent::method()`, `static::$prop`, etc. After hoisting,
		// the body lives in a top-level function with no class scope
		// — those references would be fatal at runtime ("Cannot
		// access self:: when no class scope is active"). Rewrite them
		// to the literal class name BEFORE hoisting.
		if (!empty($this->classStack)) {
			$ctx = end($this->classStack);
			SelfParentStaticRewriter::rewriteInStmts(
				$closure->stmts,
				$ctx['class'],
				$ctx['parent'],
				'hoisted closure'
			);
		}
		$bodyUsesThis = $this->bodyUsesThis($closure->stmts);
		$uses = $closure->uses;
		if ($bodyUsesThis) {
			$this->hadThisClosures = true;
			// Rewrite `$this` references inside the body to
			// `$__pg_this`. Needs its own traversal so we don't
			// reach sibling siblings' `$this` in nested closures.
			$this->renameThisInStmts($closure->stmts);
			$uses[] = new Expr\ClosureUse(
				new Expr\Variable('__pg_this'),
				false
			);
		}
		// Build capture preamble (reads from $GLOBALS at call time).
		$preamble = [];
		foreach ($uses as $use) {
			$name = $use->var->name;
			$globalKey = $helperName . '_capture';
			$fetch = new Expr\ArrayDimFetch(
				new Expr\ArrayDimFetch(
					new Expr\Variable('GLOBALS'),
					new Node\Scalar\String_($globalKey)
				),
				new Node\Scalar\String_($name)
			);
			$ternary = new Expr\Ternary(
				new Expr\Isset_([$fetch]),
				$fetch,
				new Expr\ConstFetch(new Node\Name('null'))
			);
			$preamble[] = new Stmt\Expression(
				new Expr\Assign(
					new Expr\Variable($name),
					$ternary
				)
			);
		}
		$helper = new Stmt\Function_(
			$helperName,
			[
				'byRef' => $closure->byRef,
				'params' => $closure->params,
				'returnType' => null,
				'stmts' => array_merge($preamble, $closure->stmts),
			]
		);
		$this->helpers[] = $helper;

		if (count($uses) === 0) {
			// No captures — emit the string literal directly.
			return new Node\Scalar\String_($helperName, $closure->getAttributes());
		}

		$this->needsCaptureHelper = true;
		// Build the `_pg52_set_capture('name', array(...))` call site.
		// The capture array maps the helper-side variable name (which
		// inside the helper body is read from $GLOBALS) to the
		// outer-side value being captured. For ordinary `use ($foo)`
		// captures these are the same variable; for the implicit
		// `__pg_this` capture the outer side is `$this` (which is
		// what the closure was originally bound to in the source).
		$captureItems = [];
		foreach ($uses as $use) {
			$name = $use->var->name;
			$outerExpr = $name === '__pg_this'
				? new Expr\Variable('this')
				: new Expr\Variable($name);
			$captureItems[] = new Node\ArrayItem(
				$outerExpr,
				new Node\Scalar\String_($name)
			);
		}
		return new Expr\FuncCall(
			new Node\Name('_pg52_set_capture'),
			[
				new Arg(new Node\Scalar\String_($helperName)),
				new Arg(new Expr\Array_($captureItems)),
			],
			$closure->getAttributes()
		);
	}

	/**
	 * Determines the list of variables an arrow function captures
	 * implicitly. An arrow function captures every free variable used
	 * inside the expression that isn't a parameter.
	 *
	 * @param Node\Param[] $params
	 * @return Expr\ClosureUse[]
	 */
	private function collectArrowCaptures(Expr $expr, array $params): array
	{
		$paramNames = [];
		foreach ($params as $p) {
			if ($p->var instanceof Expr\Variable && is_string($p->var->name)) {
				$paramNames[$p->var->name] = true;
			}
		}
		$collector = new class ($paramNames) extends NodeVisitorAbstract {
			/** @var array<string, true> */
			private array $paramNames;
			/** @var array<string, true> */
			public array $found = [];

			public function __construct(array $paramNames)
			{
				$this->paramNames = $paramNames;
			}

			public function enterNode(Node $node)
			{
				if (
					$node instanceof Expr\Variable
					&& is_string($node->name)
					&& $node->name !== 'this'
					&& !isset($this->paramNames[$node->name])
				) {
					$this->found[$node->name] = true;
				}
				return null;
			}
		};
		$t = new NodeTraverser();
		$t->addVisitor($collector);
		$t->traverse([new Stmt\Expression($expr)]);
		$uses = [];
		foreach (array_keys($collector->found) as $name) {
			$uses[] = new Expr\ClosureUse(new Expr\Variable($name), false);
		}
		return $uses;
	}

	/**
	 * @param array<Node\Stmt> $stmts
	 */
	private function bodyUsesThis(array $stmts): bool
	{
		$checker = new class () extends NodeVisitorAbstract {
			public bool $found = false;
			public function enterNode(Node $node)
			{
				if (
					$node instanceof Expr\Variable
					&& is_string($node->name)
					&& $node->name === 'this'
				) {
					$this->found = true;
				}
				// Don't descend into nested closures — their $this
				// belongs to a different scope.
				if (
					$node instanceof Expr\Closure
					|| $node instanceof Expr\ArrowFunction
				) {
					return NodeTraverser::DONT_TRAVERSE_CURRENT_AND_CHILDREN;
				}
				return null;
			}
		};
		$t = new NodeTraverser();
		$t->addVisitor($checker);
		$t->traverse($stmts);
		return $checker->found;
	}

	/**
	 * @param array<Node\Stmt> $stmts
	 */
	private function renameThisInStmts(array &$stmts): void
	{
		$renamer = new class () extends NodeVisitorAbstract {
			public function enterNode(Node $node)
			{
				if (
					$node instanceof Expr\Closure
					|| $node instanceof Expr\ArrowFunction
				) {
					return NodeTraverser::DONT_TRAVERSE_CURRENT_AND_CHILDREN;
				}
				return null;
			}

			public function leaveNode(Node $node)
			{
				if (
					$node instanceof Expr\Variable
					&& is_string($node->name)
					&& $node->name === 'this'
				) {
					return new Expr\Variable('__pg_this', $node->getAttributes());
				}
				return null;
			}
		};
		$t = new NodeTraverser();
		$t->addVisitor($renamer);
		$stmts = $t->traverse($stmts);
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private function slugify(string $path): string
	{
		// Stable prefix for readable names in the output.
		$base = preg_replace('/[^a-zA-Z0-9]+/', '_', $path);
		$base = trim($base, '_');
		if ($base === '') {
			$base = 'file';
		}
		return $base;
	}

	private function buildCaptureHelperWrapper(): Stmt\If_
	{
		$funcNameExists = new Expr\FuncCall(
			new Node\Name('function_exists'),
			[new Arg(new Node\Scalar\String_('_pg52_set_capture'))]
		);
		$notExists = new Expr\BooleanNot($funcNameExists);
		$fn = new Stmt\Function_(
			'_pg52_set_capture',
			[
				'byRef' => false,
				'params' => [
					new Node\Param(new Expr\Variable('name')),
					new Node\Param(new Expr\Variable('captures')),
				],
				'returnType' => null,
				'stmts' => [
					new Stmt\Expression(
						new Expr\Assign(
							new Expr\ArrayDimFetch(
								new Expr\Variable('GLOBALS'),
								new Expr\BinaryOp\Concat(
									new Expr\Variable('name'),
									new Node\Scalar\String_('_capture')
								)
							),
							new Expr\Variable('captures')
						)
					),
					new Stmt\Return_(new Expr\Variable('name')),
				],
			]
		);
		return new Stmt\If_(
			$notExists,
			['stmts' => [$fn]]
		);
	}

	private function wrapInFunctionExistsGuard(Stmt\Function_ $fn): Stmt\If_
	{
		$cond = new Expr\BooleanNot(
			new Expr\FuncCall(
				new Node\Name('function_exists'),
				[new Arg(new Node\Scalar\String_($fn->name->toString()))]
			)
		);
		return new Stmt\If_($cond, ['stmts' => [$fn]]);
	}
}
