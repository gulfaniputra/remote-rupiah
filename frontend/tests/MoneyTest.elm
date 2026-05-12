module MoneyTest exposing (..)

import Expect
import Fuzz
import Money
import Test exposing (..)

ok n s = test s (\_ -> Money.fromStr s |> Expect.equal (Ok (Money.fromCents n)))
err s = test (if s == "" then "empty string" else s) (\_ -> Money.fromStr s |> Expect.err)

suite : Test
suite =
    describe "Money.fromStr"
        [ describe "valid"
            [ ok 125055 "1,250.55", ok 125055 "1250.55", ok 50000 "500.00", ok 50000 "500"
            , ok 0 "0", ok 0 "0.00", ok 100000099 "1,000,000.99", ok 1234567801 "12,345,678.01"
            ]
        , describe "edge"
            [ ok 150 "1.5", ok 10000 "100.", ok 700 "7", ok 750 "007.50", ok 50 ".50"
            , err "1.999"
            ]
        , describe "errors"
            [ err "abc", err "12a.50", err "", err "-100.00", err "1.2.3", err "$100.00", err "1 000.00" ]
        , fuzz (Fuzz.intRange 0 999999999) "round-trip" <|
            \c ->
                let s = String.fromInt (c // 100) ++ "." ++ String.padLeft 2 '0' (String.fromInt (modBy 100 c)) in
                case Money.fromStr s of
                    Ok m -> Money.toCents m |> Expect.equal (toFloat c)
                    Err msg -> Expect.fail ("Failed for \"" ++ s ++ "\": " ++ msg)
        ]
