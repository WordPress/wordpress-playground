# Playground common

This package contains common code for the playground packages
that doesn't fit in any other package. For example, the
`RecommendedPHPVersion` is imported virtually everywhere
and including it in any other specific package would result
in a lot of circular dependencies.
