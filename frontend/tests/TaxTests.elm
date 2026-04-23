module TaxTests exposing (..)

import Expect
import Money
import TaxLogic
import Test exposing (..)


taxLogicTests : Test
taxLogicTests =
    describe "TaxLogic Module"
        [ describe "calculateNPPN"
            [ test "calculates 50% profit correctly" <|
                \_ ->
                    Money.fromCents 100000
                        |> TaxLogic.calculateNPPN
                        |> Money.toCents
                        |> Expect.equal 50000
            ]
        , describe "calculateIndoTax (2026 Progressive Brackets)"
            [ test "0 - 60M bracket (5%)" <|
                \_ ->
                    -- 10M profit -> 500k tax
                    Money.fromCents (10000000 * 100)
                        |> TaxLogic.calculateIndoTax
                        |> Money.toCents
                        |> Expect.equal (500000 * 100)
            , test "60M - 250M bracket (15%)" <|
                \_ ->
                    -- 100M profit: (60M * 5%) + (40M * 15%) = 3M + 6M = 9M
                    Money.fromCents (100000000 * 100)
                        |> TaxLogic.calculateIndoTax
                        |> Money.toCents
                        |> Expect.equal (9000000 * 100)
            , test "250M - 500M bracket (25%)" <|
                \_ ->
                    -- 433.6M profit (from Main.elm case): 
                    -- (60M * 5%) + (190M * 15%) + (183.6M * 25%) 
                    -- = 3M + 28.5M + 45.9M = 77.4M
                    Money.fromCents (433600000 * 100)
                        |> TaxLogic.calculateIndoTax
                        |> Money.toCents
                        |> Expect.equal (77400000 * 100)
            ]
        , describe "calculatePPh24Credit (Capping Logic)"
            [ test "Credit is capped by Total Indo Tax Liability" <|
                \_ ->
                    -- Actual US tax is 87M, but Indo tax is 77M. Credit should be 77M.
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 433600000
                            , totalTaxableIncome = Money.fromCents 433600000
                            , totalIndoTaxDue = Money.fromCents 77400000
                            , actualForeignTaxPaid = Money.fromCents 87370400
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 77400000
            , test "Credit is limited by the proportional formula cap" <|
                \_ ->
                    -- Foreign Net is 50% of Total Taxable. Cap should be 50% of Total Indo Tax.
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 40000
                            }
                            
                        -- Cap = (100/200) * 50 = 25
                        -- credit = min(40, 25, 50) = 25
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 25000
            ]
        , describe "calculateFXLeakage"
            [ test "calculates leak correctly" <|
                \_ ->
                    -- $1000 at 16,150 expected, but received 16,000,000 IDR
                    -- expected = 100,000 * 1,615,000 // 100 = 1,615,000,000 cents
                    -- received = 1,600,000,000 cents
                    -- leak = 15,000,000 cents (Rp 150.000)
                    TaxLogic.calculateFXLeakage (Money.fromCents 100000) 1615000 (Money.fromCents 1600000000)
                        |> Money.toCents
                        |> Expect.equal 15000000
            ]
        ]
