module Data.Wealth exposing (calculateGain)

import Money exposing (Money)


{-| Unrealized gain: units\_held \* (current\_price - historical\_price) / 100
All monetary args must share the same phantom type at call site.
-}
calculateGain : Money c -> Money c -> Money c -> Money c
calculateGain a h c =
    Money.proportion a (Money.subtract c h) (Money.fromCents 100)
