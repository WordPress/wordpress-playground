<?php
/**
 * Shared helper that rewrites every `self::`, `parent::`, and
 * `static::` reference inside an expression or statement list to use
 * an explicit class name.
 *
 * This is needed whenever code is about to be moved from inside a
 * class body (where `self::` is valid) to top-level scope (where it
 * is a fatal error on PHP 5.2 — "Cannot access self:: when no class
 * scope is active"). Two callers need this today:
 *
 *   1. {@see ArrayClassConstantVisitor} hoists non-constant class
 *      constant initializers out of the class body into top-level
 *      `ClassName::$CONST = <expr>` assignments. The `<expr>` may
 *      reference `self::OTHER_CONST`, which has to become
 *      `ClassName::OTHER_CONST` before it leaves the class.
 *
 *   2. {@see ClosureHoistingVisitor} hoists PHP 5.3+ closures into
 *      top-level named functions. The body may reference `self::X`,
 *      `parent::method()`, `static::$prop`, etc., all of which need
 *      to be rewritten before the body leaves its class scope.
 *
 * The rewriter walks nested nodes but does NOT descend into an
 * inline-defined nested class — references inside such a class
 * belong to a different scope.
 *
 * `static::` is collapsed to `self::` (then to the literal class
 * name). This loses runtime late-static-binding semantics, but for
 * the two use cases above the value is either captured at class load
 * time (constants) or the closure is hosted on a `final` data class,
 * so the distinction is irrelevant.
 *
 * If `parent::` is encountered and the enclosing class has no
 * `extends` clause, we throw a RuntimeException tagged with a
 * caller-supplied `$contextHint` — each caller wants its own error
 * wording so operators can tell which pipeline stage failed.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

class SelfParentStaticRewriter
{
	/**
	 * Rewrites every `self::X`, `parent::X`, `static::X`,
	 * `self::$P`, `parent::$P`, `static::$P`, `self::method()`, etc.
	 * inside the given expression tree so that the literal class name
	 * is used. Returns the rewritten expression (the rewriter mutates
	 * the tree in place but we go through the traverser wrapper to
	 * keep error propagation consistent with the stmts variant).
	 *
	 * @param Node\Expr   $expr        Expression to transform.
	 * @param string      $className   Enclosing class name.
	 * @param string|null $parentName  Enclosing class' parent, or null.
	 * @param string      $contextHint Caller-specific phrase used in
	 *                                 the thrown RuntimeException when
	 *                                 `parent::` is encountered and no
	 *                                 parent is known. Examples:
	 *                                 "extracted expression",
	 *                                 "hoisted closure".
	 */
	public static function rewriteInExpr(
		Node\Expr $expr,
		string $className,
		?string $parentName,
		string $contextHint
	): Node\Expr {
		$wrapped = [new Stmt\Expression($expr)];
		self::traverse($wrapped, $className, $parentName, $contextHint);
		/** @var Stmt\Expression $wrapper */
		$wrapper = $wrapped[0];
		return $wrapper->expr;
	}

	/**
	 * Rewrites every self/parent/static reference inside the given
	 * statement list in place (the array is passed by reference so the
	 * caller sees the traverser's fresh, potentially-replaced nodes).
	 *
	 * @param array<Node\Stmt> $stmts       Statement list to transform.
	 * @param string           $className   Enclosing class name.
	 * @param string|null      $parentName  Enclosing class' parent, or null.
	 * @param string           $contextHint See {@see rewriteInExpr()}.
	 */
	public static function rewriteInStmts(
		array &$stmts,
		string $className,
		?string $parentName,
		string $contextHint
	): void {
		self::traverse($stmts, $className, $parentName, $contextHint);
	}

	/**
	 * Runs the shared traverser over a statement list. Both public
	 * entrypoints funnel through here so the walk and error-reporting
	 * logic lives in exactly one place.
	 *
	 * @param array<Node\Stmt> $stmts
	 */
	private static function traverse(
		array &$stmts,
		string $className,
		?string $parentName,
		string $contextHint
	): void {
		$rewriter = new class ($className, $parentName, $contextHint) extends NodeVisitorAbstract {
			/** @var string */
			private string $className;
			/** @var string|null */
			private ?string $parentName;
			/** @var string */
			private string $contextHint;
			/** @var int Nested-class depth so we don't rewrite refs inside an inline class. */
			private int $nestedClassDepth = 0;

			public function __construct(string $className, ?string $parentName, string $contextHint)
			{
				$this->className = $className;
				$this->parentName = $parentName;
				$this->contextHint = $contextHint;
			}

			public function enterNode(Node $node)
			{
				if ($node instanceof Stmt\Class_) {
					$this->nestedClassDepth++;
				}
				return null;
			}

			public function leaveNode(Node $node)
			{
				if ($node instanceof Stmt\Class_) {
					$this->nestedClassDepth--;
					return null;
				}
				if ($this->nestedClassDepth > 0) {
					return null;
				}
				if (
					$node instanceof Expr\ClassConstFetch
					|| $node instanceof Expr\StaticPropertyFetch
					|| $node instanceof Expr\StaticCall
				) {
					if (!$node->class instanceof Node\Name) {
						return null;
					}
					$cls = $node->class->toString();
					if ($cls === 'self' || $cls === 'static') {
						$node->class = new Node\Name($this->className);
						return $node;
					}
					if ($cls === 'parent') {
						if ($this->parentName === null) {
							throw new \RuntimeException(
								"cannot rewrite parent:: in {$this->contextHint}: " .
								"class {$this->className} has no `extends` clause. " .
								"Add an explicit parent class or patch the source to avoid parent:: here."
							);
						}
						$node->class = new Node\Name($this->parentName);
						return $node;
					}
				}
				return null;
			}
		};
		$traverser = new NodeTraverser();
		$traverser->addVisitor($rewriter);
		$stmts = $traverser->traverse($stmts);
	}
}
