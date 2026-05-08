<?php
/**
 * Orchestrates the PHP 7+ -> PHP 5.2 transformation pipeline.
 *
 * One instance can be reused for multiple files. Each call to
 * {@see downgrade()} parses the source with nikic/php-parser, runs a
 * chain of {@see PhpParser\NodeVisitorAbstract} transformations, and
 * pretty-prints the result with {@see PrettyPrinter} (a subclass of
 * PhpParser\PrettyPrinter\Standard that overrides the few nodes where
 * the upstream printer emits PHP 5.3+ syntax).
 */

declare(strict_types=1);

namespace WpPlayground\Php52Downgrader;

use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\NodeVisitor\ParentConnectingVisitor;
use PhpParser\ParserFactory;
use PhpParser\PhpVersion;
use WpPlayground\Php52Downgrader\Visitor\ArrayClassConstantVisitor;
use WpPlayground\Php52Downgrader\Visitor\ArrayDerefOnCallVisitor;
use WpPlayground\Php52Downgrader\Visitor\AttributeAndDeclareStripVisitor;
use WpPlayground\Php52Downgrader\Visitor\CallableExprVisitor;
use WpPlayground\Php52Downgrader\Visitor\ClassKeywordVisitor;
use WpPlayground\Php52Downgrader\Visitor\ClosureHoistingVisitor;
use WpPlayground\Php52Downgrader\Visitor\DirConstantVisitor;
use WpPlayground\Php52Downgrader\Visitor\ExponentVisitor;
use WpPlayground\Php52Downgrader\Visitor\FinallyVisitor;
use WpPlayground\Php52Downgrader\Visitor\InstanceCallOnNewVisitor;
use WpPlayground\Php52Downgrader\Visitor\LateStaticBindingVisitor;
use WpPlayground\Php52Downgrader\Visitor\NamespaceStripVisitor;
use WpPlayground\Php52Downgrader\Visitor\NullCoalescingVisitor;
use WpPlayground\Php52Downgrader\Visitor\NullsafeVisitor;
use WpPlayground\Php52Downgrader\Visitor\Php7ErrorClassesVisitor;
use WpPlayground\Php52Downgrader\Visitor\PromoteForHoistedClosuresVisitor;
use WpPlayground\Php52Downgrader\Visitor\ReservedMethodRenameVisitor;
use WpPlayground\Php52Downgrader\Visitor\ShortTernaryVisitor;
use WpPlayground\Php52Downgrader\Visitor\StripTypeDeclarationsVisitor;
use WpPlayground\Php52Downgrader\Visitor\VariadicAndSplatVisitor;

class Downgrader
{
	/** @var \PhpParser\Parser */
	private $parser;

	/** @var PrettyPrinter */
	private $printer;

	/**
	 * Cross-file map of every class constant that has been promoted
	 * to a static property. Populated by {@see collectHoistedConsts()}
	 * (pass 1 — discovery only) and consumed by {@see downgrade()} via
	 * the {@see ArrayClassConstantVisitor} (pass 2 — full rewrite,
	 * including cross-file references).
	 *
	 * Keys are `"ClassName::CONST_NAME"` strings; values are always
	 * `true`. Empty by default — single-file callers see the previous
	 * in-file-only behaviour.
	 *
	 * @var array<string, true>
	 */
	private array $globalHoistedConsts = [];

	public function __construct()
	{
		$factory = new ParserFactory();
		// Parse as modern PHP so we accept every source feature.
		$this->parser = $factory->createForVersion(PhpVersion::fromComponents(8, 3));
		$this->printer = new PrettyPrinter();
	}

	/**
	 * Pass 1: discovers every class constant that {@see ArrayClassConstantVisitor}
	 * would promote to a static property in `$source`. The discovery
	 * runs the same visitor against a throwaway AST so the rules
	 * stay in lockstep with the actual rewrite. Side-effects:
	 * accumulates entries into `$this->globalHoistedConsts`.
	 *
	 * Call this for every file in the project BEFORE calling
	 * {@see downgrade()} on any of them, so that downgrade() can use
	 * the complete cross-file map to rewrite references like
	 * `OtherClass::SOME_CONST` (where `OtherClass` lives in a
	 * different file) into the matching `OtherClass::$SOME_CONST`
	 * static property fetch.
	 *
	 * @param string $source  Original file contents (with opening tag).
	 */
	public function collectHoistedConsts(string $source): void
	{
		$ast = $this->parser->parse($source);
		if ($ast === null) {
			throw new \RuntimeException('parser returned null');
		}
		// We need NameResolver here too so any namespaced classes get
		// the same `Foo\Bar` keys that downgrade() will emit.
		$pre = new NodeTraverser();
		$pre->addVisitor(new NameResolver(null, ['replaceNodes' => true]));
		$ast = $pre->traverse($ast);

		// Run only the namespace-strip visitor before discovery so the
		// recorded class names are unqualified, matching downgrade()
		// output. Other passes are not needed for discovery.
		$ns = new NodeTraverser();
		$ns->addVisitor(new NamespaceStripVisitor());
		$ast = $ns->traverse($ast);

		$discovery = new ArrayClassConstantVisitor();
		$t = new NodeTraverser();
		$t->addVisitor($discovery);
		$t->traverse($ast);
		foreach ($discovery->getHoisted() as $key => $_) {
			$this->globalHoistedConsts[$key] = true;
		}
	}

	/**
	 * Returns the discovered cross-file hoist registry. Useful for
	 * tests and orchestration code that needs to inspect the result
	 * of {@see collectHoistedConsts()}.
	 *
	 * @return array<string, true>
	 */
	public function getGlobalHoistedConsts(): array
	{
		return $this->globalHoistedConsts;
	}

	/**
	 * Runs the downgrade pipeline against a single file's source.
	 *
	 * If {@see collectHoistedConsts()} was called for every file
	 * beforehand, every cross-file `Foo::CONST` reference that points
	 * to a hoisted constant will be rewritten to `Foo::$CONST`.
	 * Otherwise the pass falls back to in-file-only rewriting.
	 *
	 * @param string $source  Original file contents (with opening tag).
	 * @param string $relPath Path relative to the input root. Used to
	 *                        derive deterministic closure helper names.
	 */
	public function downgrade(string $source, string $relPath): string
	{
		$ast = $this->parser->parse($source);
		if ($ast === null) {
			throw new \RuntimeException('parser returned null');
		}

		// Resolve names so that `use Foo\Bar` aliases and namespace
		// references are flattened before we rewrite them. The upstream
		// SQLite plugin has no namespaces, but NameResolver also makes
		// downstream visitors simpler because they see full Name nodes.
		$preTraverser = new NodeTraverser();
		$preTraverser->addVisitor(new NameResolver(null, ['replaceNodes' => true]));
		$ast = $preTraverser->traverse($ast);

		// Run each transform in a dedicated traversal so visitors can't
		// interfere with each other's parent/state tracking.
		$passes = [
			[new AttributeAndDeclareStripVisitor()],
			[new NamespaceStripVisitor()],
			[new StripTypeDeclarationsVisitor()],
			[new Php7ErrorClassesVisitor()],
			[new NullsafeVisitor()],
			[new NullCoalescingVisitor()],
			[new VariadicAndSplatVisitor()],
			[new ExponentVisitor()],
			[new ClassKeywordVisitor()],
			[new FinallyVisitor()],
			[new InstanceCallOnNewVisitor()],
			[new ArrayDerefOnCallVisitor()],
			[new CallableExprVisitor()],
			[new LateStaticBindingVisitor()],
			[new ShortTernaryVisitor()],
			[new DirConstantVisitor()],
			[new ArrayClassConstantVisitor($this->globalHoistedConsts)],
			[new ReservedMethodRenameVisitor()],
			// Promote private/protected → public on classes whose
			// bodies contain `$this`-using closures. Must run BEFORE
			// the closure hoister so the promoted flags survive into
			// the printed output, and AFTER every other transform so
			// it observes the final closure shape.
			[new PromoteForHoistedClosuresVisitor()],
			// Closure hoisting has to run last because most other
			// visitors rewrite subtrees that might contain closures.
			[new ClosureHoistingVisitor($relPath)],
		];

		foreach ($passes as $visitors) {
			$t = new NodeTraverser();
			foreach ($visitors as $v) {
				$t->addVisitor($v);
			}
			$ast = $t->traverse($ast);
		}

		return $this->printer->prettyPrintFile($ast) . "\n";
	}
}
