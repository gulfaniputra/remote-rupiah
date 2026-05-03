module TaxLogicTests exposing (..)

import Expect
import Fuzz
import Money exposing (Money)
import TaxLogic exposing (..)
import Test exposing (..)


suite : Test
suite =
    describe "TaxLogic Audit Refactor"
        [ describe "The Floor Test (Negative Transactions)"
            [ test "Negative gross income results in 0 tax due" <|
                \_ ->
                    let
                        report =
                            generateTaxReport (Money.fromCents -10000) Money.zero
                    in
                    Expect.equal 0 report.totalTaxDue
            ]
        , describe "The PPh 24 Ceiling"
            [ test "Foreign credit is capped at Indonesian liability" <|
                \_ ->
                    -- 100,000,000 IDR taxable profit (after 50% NPPN)
                    -- Gross IDR = 200,000,000
                    -- Tax: 60M @ 5% (3M) + 40M @ 15% (6M) = 9M
                    -- Foreign tax paid: 10,000,000
                    -- Expected credit: 9,000,000 (cap)
                    -- Total Tax Due: 9M - 9M = 0
                    let
                        grossIdr =
                            Money.fromCents 20000000000

                        foreignTax =
                            Money.fromCents 1000000000

                        report =
                            generateTaxReport grossIdr foreignTax
                    in
                    Expect.equal 0 report.totalTaxDue
            ]
        , describe "The Tier Jump (2026 Brackets)"
            [ test "Exactly 60,000,001 IDR taxable profit" <|
                \_ ->
                    -- Gross IDR = 120,000,002 (so NPPN 50% = 60,000,001)
                    -- 60M @ 5% = 3,000,000
                    -- 1 @ 15% = 0.15 -> rounds to 0? Or 1?
                    -- Wait, the prompt says "The 1 IDR over the limit is taxed at 15%".
                    -- 15% of 100 cents (1 IDR) is 15 cents.
                    -- Total tax in cents: 300,000,000 + 15 = 300,000,015.
                    let
                        grossIdr =
                            Money.fromCents 12000000200

                        report =
                            generateTaxReport grossIdr Money.zero
                    in
                    Expect.equal 300000015 report.totalTaxDue
            ]
        , describe "Fuzz Tests (Boundary Stability)"
            [ fuzz (Fuzz.intRange 0 100000000000) "Tax is never negative" <|
                \cents ->
                    let
                        report =
                            generateTaxReport (Money.fromCents cents) Money.zero
                    in
                    Expect.atLeast 0 report.totalTaxDue
            ]
        ]

