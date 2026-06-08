module WealthTest exposing (suite)

import Data.Wealth exposing (calculateGain)
import Expect
import Fuzz
import Money exposing (IDR, Money, USD)
import Test exposing (Test, describe, fuzz, test)


suite : Test
suite =
    describe "Data.Wealth"
        [ test "Verify $100 gain when IDR weakens from 15k to 16k" <| \_ -> Expect.equal (Money.fromCents 10000000) (calculateGain (Money.fromCents 10000) (Money.fromCents 1500000) (Money.fromCents 1600000))
        , fuzz (Fuzz.map Money.fromCents Fuzz.int) "Fuzz bounds" <| \u -> calculateGain u (Money.fromCents 1500000) (Money.fromCents 1600000) |> always Expect.pass
        ]
