module Data.Wealth exposing (calculateGain)
import Money exposing (Money, USD, IDR)

calculateGain : Money USD -> Money IDR -> Money IDR -> Money IDR
calculateGain a h c = Money.proportion a (Money.subtract c h) (Money.fromCents 100)
