module TaxTests exposing (..)

import Expect
import Money
import TaxLogic
import Test exposing (..)


taxLogicTests : Test
taxLogicTests =
    describe "TaxLogic Module"
        [ npwnTests
        , indoTaxBracketTests
        , pph24CreditTests
        , fxLeakageTests
        , usWithholdingTests
        , finalPayableTests
        ]



-- ──────────────────────────────────────────────
-- NPPN (50% Norma) Tests
-- ──────────────────────────────────────────────


npwnTests : Test
npwnTests =
    describe "calculateNPPN"
        [ test "calculates 50% profit correctly" <|
            \_ ->
                Money.fromCents 100000
                    |> TaxLogic.calculateNPPN
                    |> Money.toCents
                    |> Expect.equal 50000.0
        , test "zero gross produces zero taxable" <|
            \_ ->
                Money.fromCents 0
                    |> TaxLogic.calculateNPPN
                    |> Money.toCents
                    |> Expect.equal 0.0
        , test "odd amount rounds down (integer division)" <|
            \_ ->
                Money.fromCents 99999
                    |> TaxLogic.calculateNPPN
                    |> Money.toCents
                    |> Expect.equal 49999.0
        ]



-- ──────────────────────────────────────────────
-- Indonesian Progressive Tax Bracket Tests
-- ──────────────────────────────────────────────


indoTaxBracketTests : Test
indoTaxBracketTests =
    describe "calculateIndoTax (2026 Progressive Brackets)"
        [ test "0 - 60M bracket (5%)" <|
            \_ ->
                -- 10M profit -> 500k tax
                Money.fromCents (10000000 * 100)
                    |> TaxLogic.calculateIndoTax
                    |> Money.toCents
                    |> Expect.equal (toFloat (500000 * 100))
        , test "exactly 60M boundary (5%)" <|
            \_ ->
                -- 60M * 5% = 3M
                Money.fromCents (60000000 * 100)
                    |> TaxLogic.calculateIndoTax
                    |> Money.toCents
                    |> Expect.equal (toFloat (3000000 * 100))
        , test "60M - 250M bracket (15%)" <|
            \_ ->
                -- 100M profit: (60M * 5%) + (40M * 15%) = 3M + 6M = 9M
                Money.fromCents (100000000 * 100)
                    |> TaxLogic.calculateIndoTax
                    |> Money.toCents
                    |> Expect.equal (toFloat (9000000 * 100))
        , test "250M - 500M bracket (25%)" <|
            \_ ->
                -- 433.6M profit (from Main.elm case):
                -- (60M * 5%) + (190M * 15%) + (183.6M * 25%)
                -- = 3M + 28.5M + 45.9M = 77.4M
                Money.fromCents (433600000 * 100)
                    |> TaxLogic.calculateIndoTax
                    |> Money.toCents
                    |> Expect.equal (toFloat (77400000 * 100))
        , test "zero taxable income produces zero tax" <|
            \_ ->
                Money.fromCents 0
                    |> TaxLogic.calculateIndoTax
                    |> Money.toCents
                    |> Expect.equal 0.0
        ]



-- ──────────────────────────────────────────────
-- PPh 24 Foreign Tax Credit — Edge Case Suite
-- ──────────────────────────────────────────────


pph24CreditTests : Test
pph24CreditTests =
    describe "calculatePPh24Credit (\"Lesser of\" Rule)"
        [ -- ======================================
          -- CORE: Three legs of the \"Lesser of\" rule
          -- ======================================
          describe "Three-leg binding constraints"
            [ test "Leg 1 binds: Actual US tax is smallest" <|
                \_ ->
                    -- US tax paid = 5,000. Formula cap = 25,000. Indo tax = 50,000.
                    -- credit = min(5000, 25000, 50000) = 5,000
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 5000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 5000.0
            , test "Leg 2 binds: Formula cap is smallest" <|
                \_ ->
                    -- Foreign net = 50% of total taxable.
                    -- Cap = (100/200) * 50 = 25. US tax = 40. Indo tax = 50.
                    -- credit = min(40, 25, 50) = 25
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 40000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 25000.0
            , test "Leg 3 binds: Total Indo tax is smallest" <|
                \_ ->
                    -- US tax = 87M, Indo tax = 77M, formula cap = 77M (100% foreign).
                    -- credit = min(87M, 77M, 77M) = 77M
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
                        |> Expect.equal 77400000.0
            ]

        -- ======================================
        -- EDGE CASE: US withholding exceeds Indo liability
        -- ======================================
        , describe "US withholding exceeds Indonesian liability"
            [ test "large US withholding is capped at Indo tax (single source)" <|
                \_ ->
                    -- Developer earns $54,000 USD gross, KMK around 16,120.
                    -- IDR Gross = 867,480,000. NPPN = 433,740,000. Indo Tax ≈ 77.435M
                    -- US withholding = 10% of gross IDR = 86,748,000
                    -- 100% foreign income: cap = Indo tax = 77,435,000
                    -- credit = min(86,748,000, 77,435,000, 77,435,000) = 77,435,000
                    let
                        params =
                            { foreignNetIncome = Money.fromCents (433740000 * 100)
                            , totalTaxableIncome = Money.fromCents (433740000 * 100)
                            , totalIndoTaxDue = Money.fromCents (77435000 * 100)
                            , actualForeignTaxPaid = Money.fromCents (86748000 * 100)
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal (toFloat (77435000 * 100))
            , test "US withholding 3x Indo tax still caps at Indo tax" <|
                \_ ->
                    -- Extreme: US tax = 9000, formula cap = 5000, Indo tax = 5000
                    -- credit = min(9000, 5000, 5000) = 5000
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 50000
                            , totalTaxableIncome = Money.fromCents 50000
                            , totalIndoTaxDue = Money.fromCents 5000
                            , actualForeignTaxPaid = Money.fromCents 9000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 5000.0
            , test "massive US withholding on low Indo income still capped" <|
                \_ ->
                    -- Foreign = 1M, Total = 10M, Indo tax = 100k, US tax = 500k
                    -- Cap = (1M/10M) * 100k = 10k
                    -- credit = min(500k, 10k, 100k) = 10k (formula cap binds)
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 1000000
                            , totalTaxableIncome = Money.fromCents 10000000
                            , totalIndoTaxDue = Money.fromCents 100000
                            , actualForeignTaxPaid = Money.fromCents 500000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 10000.0
            ]

        -- ======================================
        -- EDGE CASE: Zero / boundary inputs
        -- ======================================
        , describe "Zero and boundary inputs"
            [ test "zero total taxable income returns zero credit (div-by-zero guard)" <|
                \_ ->
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 0
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 40000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 0.0
            , test "zero foreign net income returns zero credit" <|
                \_ ->
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 0
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 40000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 0.0
            , test "zero actual US tax paid returns zero credit" <|
                \_ ->
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 0
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 0.0
            , test "zero Indo tax due returns zero credit" <|
                \_ ->
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 0
                            , actualForeignTaxPaid = Money.fromCents 40000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 0.0
            , test "all zeros returns zero credit" <|
                \_ ->
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 0
                            , totalTaxableIncome = Money.fromCents 0
                            , totalIndoTaxDue = Money.fromCents 0
                            , actualForeignTaxPaid = Money.fromCents 0
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 0.0
            ]

        -- ======================================
        -- EDGE CASE: 100% single-source foreign income
        -- ======================================
        , describe "100% foreign income (single US client)"
            [ test "formula cap equals Indo tax when foreign = total taxable" <|
                \_ ->
                    -- When foreignNet == totalTaxable, cap = indoTax.
                    -- So credit = min(actualUS, indoTax, indoTax)
                    -- US tax = 30,000. Indo = 50,000. credit = 30,000
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 200000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 30000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 30000.0
            , test "100% foreign: US tax exceeds Indo tax" <|
                \_ ->
                    -- US tax = 80,000. Indo = 50,000. credit = 50,000
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 200000
                            , totalTaxableIncome = Money.fromCents 200000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 80000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 50000.0
            ]

        -- ======================================
        -- EDGE CASE: Partial foreign income (mixed domestic+foreign)
        -- ======================================
        , describe "Partial foreign income (mixed sources)"
            [ test "25% foreign income reduces cap proportionally" <|
                \_ ->
                    -- Foreign = 250k, Total = 1M, Indo tax = 100k
                    -- Cap = (250/1000) * 100 = 25k. US tax = 30k.
                    -- credit = min(30k, 25k, 100k) = 25k
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 250000
                            , totalTaxableIncome = Money.fromCents 1000000
                            , totalIndoTaxDue = Money.fromCents 100000
                            , actualForeignTaxPaid = Money.fromCents 30000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 25000.0
            , test "10% foreign income severely limits credit" <|
                \_ ->
                    -- Foreign = 100k, Total = 1M, Indo tax = 100k, US tax = 15k
                    -- Cap = (100/1000) * 100 = 10k.
                    -- credit = min(15k, 10k, 100k) = 10k
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 100000
                            , totalTaxableIncome = Money.fromCents 1000000
                            , totalIndoTaxDue = Money.fromCents 100000
                            , actualForeignTaxPaid = Money.fromCents 15000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 10000.0
            ]

        -- ======================================
        -- EDGE CASE: Micro-income (small amounts, integer precision)
        -- ======================================
        , describe "Micro-income (integer precision edge)"
            [ test "1 cent foreign income" <|
                \_ ->
                    -- Foreign = 1, Total = 100, Indo = 10, US = 5
                    -- Cap = (1 * 10) // 100 = 0 (integer truncation)
                    -- credit = min(5, 0, 10) = 0
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 1
                            , totalTaxableIncome = Money.fromCents 100
                            , totalIndoTaxDue = Money.fromCents 10
                            , actualForeignTaxPaid = Money.fromCents 5
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 0.0
            , test "small amounts where cap rounds down" <|
                \_ ->
                    -- Foreign = 3, Total = 7, Indo = 5, US = 4
                    -- Cap = (3 * 5) // 7 = 15 // 7 = 2
                    -- credit = min(4, 2, 5) = 2
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 3
                            , totalTaxableIncome = Money.fromCents 7
                            , totalIndoTaxDue = Money.fromCents 5
                            , actualForeignTaxPaid = Money.fromCents 4
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 2.0
            ]

        -- ======================================
        -- EDGE CASE: All three legs equal
        -- ======================================
        , describe "Tie-breaking"
            [ test "all three legs equal returns that value" <|
                \_ ->
                    -- Foreign = Total, so cap = Indo tax. US tax = Indo tax = cap.
                    -- All three = 50,000. credit = 50,000
                    let
                        params =
                            { foreignNetIncome = Money.fromCents 500000
                            , totalTaxableIncome = Money.fromCents 500000
                            , totalIndoTaxDue = Money.fromCents 50000
                            , actualForeignTaxPaid = Money.fromCents 50000
                            }
                    in
                    TaxLogic.calculatePPh24Credit params
                        |> Money.toCents
                        |> Expect.equal 50000.0
            ]

        -- ======================================
        -- REALISTIC: Full pipeline integration test
        -- ======================================
        , describe "Full pipeline integration"
            [ test "realistic: $54k developer, 100% US, W-8BEN at 10%" <|
                \_ ->
                    -- Gross USD = $54,000 = 5,400,000 cents
                    -- KMK rate ~16,120 (scaled *100 = 1,612,000)
                    -- IDR gross = 5,400,000 * 1,612,000 / 100 = 87,048,000,000,000 IDR cents
                    --   ... that's 870,480,000 IDR (or 870.48M IDR)
                    -- NPPN = 435,240,000 IDR (435.24M) = taxable income
                    -- US withholding = 10% of 870.48M = 87,048,000 IDR
                    -- Indo tax on 435.24M:
                    --   5% on 60M   = 3M
                    --   15% on 190M = 28.5M
                    --   25% on 185.24M = 46.31M
                    --   Total = 77.81M
                    -- Since 100% foreign: cap = Indo tax = 77,810,000
                    -- credit = min(87,048,000, 77,810,000, 77,810,000) = 77,810,000
                    -- Final payable = 77,810,000 - 77,810,000 = 0
                    -- (Developer fully offsets Indo tax with US credit)
                    let
                        grossIdr =
                            Money.fromCents (870480000 * 100)

                        taxableIncome =
                            TaxLogic.calculateNPPN grossIdr

                        indoTax =
                            TaxLogic.calculateIndoTax taxableIncome

                        usWithholding =
                            TaxLogic.calculateUsWithholding grossIdr

                        pph24 =
                            TaxLogic.calculatePPh24Credit
                                { foreignNetIncome = taxableIncome
                                , totalTaxableIncome = taxableIncome
                                , totalIndoTaxDue = indoTax
                                , actualForeignTaxPaid = usWithholding
                                }

                        finalPayable =
                            TaxLogic.calculateFinalPayable indoTax pph24
                    in
                    -- US withholding (87.048M) exceeds Indo tax (~77.81M),
                    -- so credit is capped at Indo tax, and final payable = 0.
                    Expect.all
                        [ \_ ->
                            Money.toCents usWithholding
                                |> Expect.greaterThan (Money.toCents indoTax)
                        , \_ ->
                            Money.toCents pph24
                                |> Expect.equal (Money.toCents indoTax)
                        , \_ ->
                            Money.toCents finalPayable
                                |> Expect.equal 0.0
                        ]
                        ()
            , test "realistic: $30k developer where Indo tax exceeds US withholding" <|
                \_ ->
                    -- Gross IDR = 483,600,000 ($30k * 16,120)
                    -- NPPN = 241,800,000 (241.8M taxable)
                    -- Indo tax on 241.8M:
                    --   5% on 60M = 3M
                    --   15% on 181.8M = 27.27M
                    --   Total = 30.27M
                    -- US withholding = 10% of 483.6M = 48.36M
                    -- 100% foreign: cap = Indo tax = 30.27M
                    -- credit = min(48.36M, 30.27M, 30.27M) = 30.27M
                    -- Again fully offset, final payable = 0
                    let
                        grossIdr =
                            Money.fromCents (483600000 * 100)

                        taxableIncome =
                            TaxLogic.calculateNPPN grossIdr

                        indoTax =
                            TaxLogic.calculateIndoTax taxableIncome

                        usWithholding =
                            TaxLogic.calculateUsWithholding grossIdr

                        pph24 =
                            TaxLogic.calculatePPh24Credit
                                { foreignNetIncome = taxableIncome
                                , totalTaxableIncome = taxableIncome
                                , totalIndoTaxDue = indoTax
                                , actualForeignTaxPaid = usWithholding
                                }

                        finalPayable =
                            TaxLogic.calculateFinalPayable indoTax pph24
                    in
                    Expect.all
                        [ \_ ->
                            Money.toCents usWithholding
                                |> Expect.greaterThan (Money.toCents indoTax)
                        , \_ ->
                            Money.toCents pph24
                                |> Expect.equal (Money.toCents indoTax)
                        , \_ ->
                            Money.toCents finalPayable
                                |> Expect.equal 0.0
                        ]
                        ()
            ]
        ]



-- ──────────────────────────────────────────────
-- US Withholding Tests
-- ──────────────────────────────────────────────


usWithholdingTests : Test
usWithholdingTests =
    describe "calculateUsWithholding"
        [ test "10% W-8BEN rate on $10k" <|
            \_ ->
                Money.fromCents 1000000
                    |> TaxLogic.calculateUsWithholding
                    |> Money.toCents
                    |> Expect.equal 100000.0
        , test "zero gross produces zero withholding" <|
            \_ ->
                Money.fromCents 0
                    |> TaxLogic.calculateUsWithholding
                    |> Money.toCents
                    |> Expect.equal 0.0
        ]



-- ──────────────────────────────────────────────
-- FX Leakage Tests
-- ──────────────────────────────────────────────


fxLeakageTests : Test
fxLeakageTests =
    describe "calculateFXLeakage"
        [ test "calculates leak correctly" <|
            \_ ->
                -- $1000 at 16,150 expected, but received 16,000,000 IDR
                -- expected = 100,000 * 1,615,000 // 100 = 1,615,000,000 cents
                -- received = 1,600,000,000 cents
                -- leak = 15,000,000 cents (Rp 150.000)
                TaxLogic.calculateFXLeakage (Money.fromCents 100000) 1615000 (Money.fromCents 1600000000)
                    |> Money.toCents
                    |> Expect.equal 15000000.0
        , test "zero leak when rates match" <|
            \_ ->
                TaxLogic.calculateFXLeakage (Money.fromCents 100000) 1612000 (Money.fromCents 1612000000)
                    |> Money.toCents
                    |> Expect.equal 0.0
        ]



-- ──────────────────────────────────────────────
-- Final Payable Tests
-- ──────────────────────────────────────────────


finalPayableTests : Test
finalPayableTests =
    describe "calculateFinalPayable"
        [ test "subtracts credit from total tax" <|
            \_ ->
                TaxLogic.calculateFinalPayable (Money.fromCents 100000) (Money.fromCents 30000)
                    |> Money.toCents
                    |> Expect.equal 70000.0
        , test "fully offset when credit equals tax" <|
            \_ ->
                TaxLogic.calculateFinalPayable (Money.fromCents 50000) (Money.fromCents 50000)
                    |> Money.toCents
                    |> Expect.equal 0.0
        ]
