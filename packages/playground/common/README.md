# Playground common

This package contains common code for the playground packages
that doesn't fit in any other package. For example, the
`RecommendedPHPVersion` is imported virtually everywhere
and including it in any other specific package would result
in a lot of circular dependencies.

Avoid adding new code to this package. @wp-playground/common should remain
as lean as possible. It only exists to avoid circular dependencies. Let's not
use it as a default place to add code that doesn't seem to fit
anywhere else. If there's no good place for your code, perhaps
it needs to be restructured? Or maybe there's a need for a new package?
Let's always consider these questions before adding new code here.
