<?php
/**
 * Strips namespace syntax that PHP 5.2 can't parse.
 *
 * The upstream SQLite plugin doesn't define any `namespace ...` blocks,
 * but it does reference a few fully-qualified class names with a
 * leading backslash (`\Exception`, `\PDO`). PHP 5.2 has no namespace
 * support at all and bails out on the leading `\`. Rewrite every
 * fully-qualified Name to an unqualified one.
 *
 * If a file *does* wrap itself in `namespace Foo;` we collapse the
 * namespace block into top-level statements — this matches the zero
 * effective namespaces the plugin ships with today. Any future files
 * with real non-global namespaces will need a per-file surgical fix.
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader\Visitor;

use PhpParser\Node;
use PhpParser\Node\Name;
use PhpParser\Node\Stmt;
use PhpParser\NodeVisitorAbstract;

class NamespaceStripVisitor extends NodeVisitorAbstract
{
	public function beforeTraverse(array $nodes)
	{
		// Flatten `namespace Foo { ... }` / `namespace Foo;` wrappers by
		// replacing them with their inner statements. We accept any
		// namespace name (bare `namespace;` is allowed), so the SQLite
		// plugin's hypothetical future use will keep working provided
		// the names are never referenced qualified.
		$out = [];
		foreach ($nodes as $node) {
			if ($node instanceof Stmt\Namespace_) {
				foreach ($node->stmts as $inner) {
					if ($inner instanceof Stmt\Use_) {
						// Drop use statements; after NameResolver has
						// run, references are already fully resolved.
						continue;
					}
					$out[] = $inner;
				}
				continue;
			}
			$out[] = $node;
		}
		return $out;
	}

	public function enterNode(Node $node)
	{
		if ($node instanceof Name) {
			// Turn any Name variant into an unqualified identifier.
			// After NameResolver, the Name contains fully-qualified
			// components like `Foo\Bar`. For PHP 5.2 we keep only the
			// last component (`Bar`). This is safe here because the
			// SQLite plugin has no real namespaces.
			if ($node->isFullyQualified() || $node->isQualified()) {
				$parts = $node->getParts();
				return new Name([end($parts)], $node->getAttributes());
			}
		}
		return null;
	}
}
