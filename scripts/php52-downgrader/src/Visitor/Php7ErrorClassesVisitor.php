<?php
/**
 * Rewrites PHP 7 error class references to the pre-7 Exception class.
 *
 * Covers:
 *  - `catch (Throwable|Error $e)` in `try`/`catch` clauses.
 *  - `new TypeError(...)`, `new Error(...)`, etc.
 *  - `extends Error` in class declarations.
 *  - `instanceof Throwable` checks.
 *
 * PHP 5.2 only knows \Exception, so every reference is flattened down
 * to that single class.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Name;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitorAbstract;

class Php7ErrorClassesVisitor extends NodeVisitorAbstract
{
	/** @var string[] */
	private const REMAPPED = [
		'Throwable',
		'Error',
		'TypeError',
		'ArgumentCountError',
		'ValueError',
		'ArithmeticError',
		'DivisionByZeroError',
		'AssertionError',
		'ParseError',
		'UnhandledMatchError',
	];

	public function enterNode(Node $node)
	{
		if ($node instanceof Stmt\Catch_) {
			$node->types = array_map(
				[$this, 'remapName'],
				$node->types
			);
			// Deduplicate Exception entries.
			$seen = [];
			$unique = [];
			foreach ($node->types as $t) {
				$key = $t->toString();
				if (isset($seen[$key])) {
					continue;
				}
				$seen[$key] = true;
				$unique[] = $t;
			}
			$node->types = $unique;
			return null;
		}

		if ($node instanceof Node\Expr\New_ && $node->class instanceof Name) {
			$node->class = $this->remapName($node->class);
			return null;
		}

		if ($node instanceof Stmt\Class_) {
			if ($node->extends instanceof Name) {
				$node->extends = $this->remapName($node->extends);
			}
			return null;
		}

		if ($node instanceof Node\Expr\Instanceof_ && $node->class instanceof Name) {
			$node->class = $this->remapName($node->class);
			return null;
		}

		return null;
	}

	private function remapName(Name $name): Name
	{
		if (in_array($name->toString(), self::REMAPPED, true)) {
			return new Name('Exception', $name->getAttributes());
		}
		return $name;
	}
}
