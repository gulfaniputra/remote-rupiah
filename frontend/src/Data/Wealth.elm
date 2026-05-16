module Data.Wealth exposing (calculateGain)

import Money exposing (Money)

{-| Unrealized gain: units_held * (current_price - historical_price) / 100
All monetary args must share the same phantom type at call site.
-}
calculateGain : Money c -> Money c -> Money c -> Money c
calculateGain a h c = Money.proportion a (Money.subtract c h) (Money.fromCents 100)
