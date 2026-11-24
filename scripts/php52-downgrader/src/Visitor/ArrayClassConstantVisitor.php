<?php
/**
 * Rewrites class constants whose default value is not a PHP 5.2
 * compile-time constant expression into static properties plus a
 * runtime initializer.
 *
 * The PHP 5.2 grammar restricts class constants to simple scalar
 * literals (int, float, string, bool, null) and class constant
 * references to OTHER classes that are already loaded. Anything else
 * — array literals, string concatenation, self/static references,
 * function calls (via `dirname(__FILE__)`) — raises a parse error.
 *
 * We transform each such const into:
 *
 *   public static $NAME = null;   // in the class body
 *   ClassName::$NAME = <expr>;    // after the class, at top level
 *
 * and rewrite every `self::NAME` / `static::NAME` / `ClassName::NAME`
 * reference in the file to the matching static property fetch.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Modifiers;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

class ArrayClassConstantVisitor extends NodeVisitorAbstract
{
	/**
	 * Map "ClassName::CONST_NAME" => true of every constant we've
	 * promoted to a static property in THIS file so far.
	 *
	 * @var array<string, true>
	 */
	private array $hoisted = [];

	/**
	 * Map "ClassName::CONST_NAME" => true populated externally with
	 * EVERY constant that will be promoted across all files in the
	 * project. Allows cross-file references (e.g. user code in file
	 * A reading `Foo::BAR` where `Foo::BAR` was promoted in file B)
	 * to be rewritten to the matching `Foo::$BAR` static property
	 * fetch. Defaults to empty for backwards compatibility — single
	 * file callers see the previous in-file-only behaviour.
	 *
	 * @var array<string, true>
	 */
	private array $globalHoisted;

	/**
	 * @param array<string, true> $globalHoisted External registry of
	 *        every constant known to be promoted across all files.
	 *        See {@see $globalHoisted} for usage.
	 */
	public function __construct(array $globalHoisted = [])
	{
		$this->globalHoisted = $globalHoisted;
	}

	public function beforeTraverse(array $nodes)
	{
		$this->hoisted = [];
		$this->processStatementList($nodes);
		return $nodes;
	}

	/**
	 * Returns the per-file map of constants this pass promoted from
	 * `const FOO = ...;` to `public static $FOO`. Used by the
	 * orchestrator to build {@see $globalHoisted} for a second pass.
	 *
	 * @return array<string, true>
	 */
	public function getHoisted(): array
	{
		return $this->hoisted;
	}

	public function afterTraverse(array $nodes)
	{
		// Merge in-file hoists (which we always know about, even on
		// pass 1) with externally-supplied cross-file hoists. The
		// second pass populates `$globalHoisted` with the union of
		// every file's promotions; on the first pass it's empty and
		// we still need to rewrite in-file references so the file
		// itself stays consistent.
		$lookup = $this->hoisted + $this->globalHoisted;
		if (empty($lookup)) {
			return null;
		}
		// Second pass: rewrite every matching ClassConstFetch to a
		// StaticPropertyFetch using a fresh traverser.
		$rewriter = new class ($lookup) extends NodeVisitorAbstract {
			/** @var array<string, true> */
			private array $hoisted;
			/** @var string|null */
			private ?string $currentClass = null;
			/** @var string|null */
			private ?string $currentParent = null;

			public function __construct(array $hoisted)
			{
				$this->hoisted = $hoisted;
			}

			public function enterNode(Node $node)
			{
				if ($node instanceof Stmt\Class_) {
					$this->currentClass = $node->name !== null ? $node->name->toString() : null;
					$this->currentParent = $node->extends !== null ? $node->extends->toString() : null;
				}
				return null;
			}

			public function leaveNode(Node $node)
			{
				if ($node instanceof Stmt\Class_) {
					$this->currentClass = null;
					$this->currentParent = null;
				}
				if (
					!$node instanceof Expr\ClassConstFetch
					|| !$node->name instanceof Node\Identifier
					|| !$node->class instanceof Node\Name
				) {
					return null;
				}
				$cls = $node->class->toString();
				$name = $node->name->toString();
				$resolved = $cls;
				if ($cls === 'self' || $cls === 'static') {
					$resolved = $this->currentClass ?? $cls;
				} elseif ($cls === 'parent') {
					$resolved = $this->currentParent ?? $cls;
				}
				if (!isset($this->hoisted[$resolved . '::' . $name])) {
					return null;
				}
				return new Expr\StaticPropertyFetch(
					new Node\Name($cls === 'static' ? 'self' : $cls),
					new Node\VarLikeIdentifier($name),
					$node->getAttributes()
				);
			}
		};
		$t = new NodeTraverser();
		$t->addVisitor($rewriter);
		return $t->traverse($nodes);
	}

	/**
	 * Walks a statement list and rewrites any class declarations in it
	 * that contain non-constant-expression class constants. Recurses
	 * into blocks (if, while, namespace wrappers, etc.).
	 *
	 * @param array<Node\Stmt> $stmts passed by reference to splice in
	 *                                the static initializer blocks.
	 */
	private function processStatementList(array &$stmts): void
	{
		for ($i = 0; $i < count($stmts); $i++) {
			$stmt = $stmts[$i];
			if ($stmt instanceof Stmt\Class_) {
				$initializers = $this->rewriteClass($stmt);
				if ($initializers) {
					array_splice($stmts, $i + 1, 0, $initializers);
					$i += count($initializers);
				}
				continue;
			}
			// Recurse into nested statement lists.
			foreach (['stmts', 'cases', 'catches', 'finally'] as $field) {
				if (isset($stmt->{$field}) && is_array($stmt->{$field})) {
					$list = $stmt->{$field};
					$this->processStatementList($list);
					$stmt->{$field} = $list;
				}
			}
			if (isset($stmt->else) && $stmt->else !== null) {
				$list = $stmt->else->stmts;
				$this->processStatementList($list);
				$stmt->else->stmts = $list;
			}
			if (isset($stmt->elseifs) && is_array($stmt->elseifs)) {
				foreach ($stmt->elseifs as $elseif) {
					$list = $elseif->stmts;
					$this->processStatementList($list);
					$elseif->stmts = $list;
				}
			}
		}
	}

	/**
	 * Rewrites a single class declaration in place and returns the
	 * list of static initializer statements to inject after it.
	 *
	 * @return array<Stmt\Expression>
	 */
	private function rewriteClass(Stmt\Class_ $class): array
	{
		$className = $class->name?->toString();
		if ($className === null) {
			return [];
		}
		$initializers = [];
		$newStmts = [];
		foreach ($class->stmts as $stmt) {
			if (!$stmt instanceof Stmt\ClassConst) {
				$newStmts[] = $stmt;
				continue;
			}
			$kept = [];
			$hoistedConsts = [];
			foreach ($stmt->consts as $const) {
				if ($this->isPhp52ConstantExpr($const->value)) {
					$kept[] = $const;
					continue;
				}
				$hoistedConsts[] = $const;
			}
			if ($kept) {
				$splitStmt = clone $stmt;
				$splitStmt->consts = $kept;
				$newStmts[] = $splitStmt;
			}
			$parentName = $class->extends?->toString();
			foreach ($hoistedConsts as $const) {
				$this->hoisted[$className . '::' . $const->name->name] = true;
				$newStmts[] = new Stmt\Property(
					Modifiers::PUBLIC | Modifiers::STATIC,
					[
						new Node\PropertyItem(
							new Node\VarLikeIdentifier($const->name->name),
							new Expr\ConstFetch(new Node\Name('null'))
						),
					]
				);
				// CRITICAL: the value is about to be moved OUT of the
				// class body to top-level scope, where `self::`,
				// `parent::`, and `static::` are no longer valid.
				// Rewrite every such reference to the literal class
				// name before emitting the initializer.
				$rewrittenValue = SelfParentStaticRewriter::rewriteInExpr(
					$const->value,
					$className,
					$parentName,
					'extracted expression'
				);
				$initializers[] = new Stmt\Expression(
					new Expr\Assign(
						new Expr\StaticPropertyFetch(
							new Node\Name($className),
							new Node\VarLikeIdentifier($const->name->name)
						),
						$rewrittenValue
					)
				);
			}
		}
		$class->stmts = $newStmts;
		return $initializers;
	}

	/**
	 * Returns true when the expression is a PHP 5.2 compile-time
	 * constant expression (scalar literal, true/false/null,
	 * or a negated/plussed literal).
	 */
	private function isPhp52ConstantExpr(Node\Expr $expr): bool
	{
		if ($expr instanceof Node\Scalar\Int_) {
			return true;
		}
		if ($expr instanceof Node\Scalar\Float_) {
			return true;
		}
		if ($expr instanceof Node\Scalar\String_) {
			return true;
		}
		if ($expr instanceof Expr\ConstFetch) {
			$name = $expr->name->toString();
			return in_array(
				$name,
				['true', 'false', 'null', 'TRUE', 'FALSE', 'NULL'],
				true
			);
		}
		if ($expr instanceof Expr\UnaryMinus || $expr instanceof Expr\UnaryPlus) {
			return $this->isPhp52ConstantExpr($expr->expr);
		}
		return false;
	}
}
