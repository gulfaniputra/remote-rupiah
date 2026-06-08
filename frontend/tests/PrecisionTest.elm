module PrecisionTest exposing (..)

import Expect
import Money
import Test exposing (..)


precisionTests : Test
precisionTests =
    describe "Precision Tests"
        [ test "100B IDR + 1 cent precision" <|
            \_ ->
                Money.add (Money.fromCentsStr "10000000000000") (Money.fromCents 1)
                    |> Money.toAuthoritativeString
                    |> Expect.equal "10000000000001"
        ]
