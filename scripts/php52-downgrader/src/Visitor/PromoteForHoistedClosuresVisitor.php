<?php
/**
 * Promotes private/protected members to public in any class whose
 * body contains a closure that captures `$this`.
 *
 * The {@see ClosureHoistingVisitor} hoists every closure to a
 * top-level function and rewrites references to `$this` into
 * `$__pg_this`. PHP 5.2 has no closures and no `Closure::bind()`,
 * so the hoisted helper runs from global scope — it has no
 * visibility into private or protected members of the enclosing
 * class.
 *
 * To make those member accesses succeed, we promote every
 * non-public property and method on the enclosing class (and its
 * descendants) to `public`.  A focused, opt-in promotion (only on
 * classes that actually need it) keeps the rest of the codebase
 * unchanged so visibility-sensitive features like __set magic and
 * inherited protected hooks still work elsewhere.
 *
 * The visitor is meant to run BEFORE {@see ClosureHoistingVisitor}
 * so the change is observed by the eventual rewrite output.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Modifiers;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;

class PromoteForHoistedClosuresVisitor extends NodeVisitorAbstract
{
	public function enterNode(Node $node)
	{
		if (!$node instanceof Stmt\Class_) {
			return null;
		}
		if (!$this->classContainsThisClosure($node)) {
			return null;
		}
		foreach ($node->stmts as $stmt) {
			if ($stmt instanceof Stmt\Property) {
				$stmt->flags = self::makePublic($stmt->flags);
			} elseif ($stmt instanceof Stmt\ClassMethod) {
				$stmt->flags = self::makePublic($stmt->flags);
			}
		}
		return null;
	}

	/**
	 * True if any closure (or arrow function) inside this class body
	 * — at any nesting depth, but excluding nested-class scopes —
	 * references `$this`. Closures with no `$this` reference do not
	 * need member-visibility promotion because the helper body never
	 * touches an instance.
	 */
	private function classContainsThisClosure(Stmt\Class_ $class): bool
	{
		$found = false;
		$visitor = new class () extends NodeVisitorAbstract {
			public bool $found = false;
			/** @var int Nested class depth — refs to `$this` inside an
			 *           anonymous inner class belong to a different
			 *           scope and don't trigger promotion of the
			 *           outer. We never enter the *outer* class itself
			 *           because the caller passes its body directly. */
			private int $nestedDepth = 0;

			public function enterNode(Node $node)
			{
				if ($node instanceof Stmt\Class_) {
					$this->nestedDepth++;
					return null;
				}
				if ($this->nestedDepth > 0) {
					return null;
				}
				if (
					$node instanceof Expr\Closure
					|| $node instanceof Expr\ArrowFunction
				) {
					if ($this->closureUsesThis($node)) {
						$this->found = true;
						return NodeTraverser::STOP_TRAVERSAL;
					}
				}
				return null;
			}

			public function leaveNode(Node $node)
			{
				if ($node instanceof Stmt\Class_) {
					$this->nestedDepth--;
				}
				return null;
			}

			private function closureUsesThis(Node $closure): bool
			{
				$found = false;
				$walker = new class () extends NodeVisitorAbstract {
					public bool $found = false;
					public function enterNode(Node $n)
					{
						if (
							$n instanceof Expr\Variable
							&& is_string($n->name)
							&& $n->name === 'this'
						) {
							$this->found = true;
							return NodeTraverser::STOP_TRAVERSAL;
						}
						if (
							$n instanceof Expr\Closure
							|| $n instanceof Expr\ArrowFunction
						) {
							// Don't descend into nested closures; their
							// `$this` belongs to their own scope. The
							// outer closure's loop will visit them
							// independently.
							return NodeTraverser::DONT_TRAVERSE_CURRENT_AND_CHILDREN;
						}
						return null;
					}
				};
				$traverser = new NodeTraverser();
				$traverser->addVisitor($walker);
				$body = $closure instanceof Expr\Closure
					? $closure->stmts
					: [new Stmt\Return_($closure->expr)];
				$traverser->traverse($body);
				return $walker->found;
			}
		};
		$traverser = new NodeTraverser();
		$traverser->addVisitor($visitor);
		// Walk the class body but NOT the class node itself (to avoid
		// the nestedDepth bookkeeping running on the outer class).
		$traverser->traverse($class->stmts);
		return $visitor->found;
	}

	/**
	 * Clears the PROTECTED and PRIVATE flag bits and sets PUBLIC.
	 * Preserves STATIC/ABSTRACT/FINAL.
	 */
	private static function makePublic(int $flags): int
	{
		$flags &= ~(Modifiers::PROTECTED | Modifiers::PRIVATE);
		$flags |= Modifiers::PUBLIC;
		return $flags;
	}
}
