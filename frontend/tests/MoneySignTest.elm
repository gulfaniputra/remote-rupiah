module MoneySignTest exposing (suite)

import Expect
import Money exposing (Money)
import Test exposing (Test, describe, test)


suite : Test
suite =
    describe "Money Domain Core Parsing & Boundary Properties"
        [ test "Verify retention of negative values for tracking downstream FX losses" <|
            \_ ->
                Money.fromCentsStr "-125050"
                    |> Money.toAuthoritativeString
                    |> Expect.equal "-125050"
        , test "Verify automatic structural fallback to zero integer on malformed alphabetic garbage" <|
            \_ ->
                Money.fromCentsStr "malformed_hex_value_nan"
                    |> Money.toAuthoritativeString
                    |> Expect.equal "0"
        ]
