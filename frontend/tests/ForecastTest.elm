module ForecastTest exposing (suite)

import Expect
import Fuzz
import Money
import TaxLogic exposing (..)
import Test exposing (..)


p : Money.Money -> Int -> Money.Money
p =
    TaxLogic.projectYearEndLiability TaxLogic.defaultBrackets


suite : Test
suite =
    describe "Forecast"
        [ test "50M@5mo=3M" <| \_ -> Expect.equal (Money.fromCents 300000000) (p (Money.fromCents 5000000000) 5)
        , test "mo=0" <| \_ -> Expect.equal Money.zero (p (Money.fromCents 5000000000) 0)
        , test "mo<0" <| \_ -> Expect.equal Money.zero (p (Money.fromCents 5000000000) -3)
        , test "120M@12mo=3M" <| \_ -> Expect.equal (Money.fromCents 300000000) (p (Money.fromCents 12000000000) 12)
        , test "30M@6mo=1.5M" <| \_ -> Expect.equal (Money.fromCents 150000000) (p (Money.fromCents 3000000000) 6)
        , test "100M@4mo=16.5M" <| \_ -> Expect.equal (Money.fromCents 1650000000) (p (Money.fromCents 10000000000) 4)
        , test "zero" <| \_ -> Expect.equal Money.zero (p Money.zero 6)
        , test "ceil>=floor" <|
            \_ ->
                let
                    v =
                        Money.fromCents 1000000000
                in
                Money.compare (p v 7) (calculateIndoTax TaxLogic.defaultBrackets (TaxLogic.calculateNppn (Money.divide (Money.multiply v 12) 7))) |> Expect.notEqual LT
        , fuzz (Fuzz.intRange 0 500000000000) ">=0" <| \c -> Money.fromCents c |> (\m -> p m 6) |> (\r -> Money.compare r Money.zero) |> Expect.notEqual LT
        , fuzz (Fuzz.intRange 1 12) "mo>=0" <| \m -> p (Money.fromCents 5000000000) m |> (\r -> Money.compare r Money.zero) |> Expect.notEqual LT
        , fuzz (Fuzz.intRange 0 100000000000) "<=35%" <|
            \c ->
                let
                    y =
                        Money.fromCents c
                in
                -- Cleaned up sequential operations to avoid nested type compilation errors
                Money.compare (p y 6) (Money.divide (Money.multiply (Money.divideRoundUp (Money.multiply y 12) 6) 35) 100) |> Expect.notEqual GT
        ]
