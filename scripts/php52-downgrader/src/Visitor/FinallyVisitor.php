<?php
/**
 * Rewrites `try { T } catch { C } finally { F }` blocks to the
 * PHP 5.2-compatible form by duplicating the finally body.
 *
 * Strategy:
 *   * Append `F` to the try body so it runs after normal completion.
 *   * Append `F` to each catch body so it runs after an exception is
 *     handled.
 *   * When there are no catches, synthesize a bare
 *     `catch (Exception $__pg_fe) { F; throw $__pg_fe; }` so the
 *     finally body still runs when the exception is uncaught.
 *
 * Caveats:
 *   * `return`/`throw`/`goto` inside the try or catch bodies bypass
 *     the duplicated block. The upstream SQLite plugin uses finally
 *     only for cleanup where this is acceptable.
 *   * Nested finally blocks are rewritten bottom-up by the traverser
 *     (we operate on `leaveNode`).
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Arg;
use PhpParser\Node\Expr;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitorAbstract;

class FinallyVisitor extends NodeVisitorAbstract
{
	public function leaveNode(Node $node)
	{
		if (!$node instanceof Stmt\TryCatch) {
			return null;
		}
		if ($node->finally === null) {
			return null;
		}
		$finallyStmts = $node->finally->stmts;
		$cloneFinally = function () use ($finallyStmts) {
			return array_map(fn(Stmt $s) => clone $s, $finallyStmts);
		};
		$newTryStmts = array_merge($node->stmts, $cloneFinally());
		$newCatches = [];
		if (count($node->catches) === 0) {
			$rethrow = new Stmt\Expression(
				new Expr\Throw_(new Expr\Variable('__pg_fe'))
			);
			$catchStmts = array_merge($cloneFinally(), [$rethrow]);
			$newCatches[] = new Stmt\Catch_(
				[new Node\Name('Exception')],
				new Expr\Variable('__pg_fe'),
				$catchStmts
			);
		} else {
			foreach ($node->catches as $c) {
				$c = clone $c;
				$c->stmts = array_merge($c->stmts, $cloneFinally());
				$newCatches[] = $c;
			}
		}
		return new Stmt\TryCatch(
			$newTryStmts,
			$newCatches,
			null,
			$node->getAttributes()
		);
	}
}
