module TaxLogicTests exposing (..)

import Expect
import Fuzz
import Money exposing (Money, IDR)
import TaxLogic exposing (..)
import Test exposing (..)


suite : Test
suite =
    describe "Tax Logic Comprehensive Suite"
        [ describe "Legacy Tests"
            [ test "nppn" <| \_ -> Expect.equal (Money.fromCents 817500000) (calculateNppnProfit (Money.fromCents 100000) 1635000)
            , test "pph24" <| \_ -> Expect.equal (Money.fromCents 1000000000) (calculatePPh24Credit { foreignNetIncome = Money.fromCents 10000000000, totalTaxableIncome = Money.fromCents 20000000000, totalIndoTaxDue = Money.fromCents 2000000000, actualForeignTaxPaid = Money.fromCents 1500000000 })
            , test "neg" <| \_ -> Expect.equal "0" (generateTaxReport (Money.fromCents -10000) Money.zero).totalTaxDue
            , test "cap" <| \_ -> Expect.equal "0" (generateTaxReport (Money.fromCents 20000000000) (Money.fromCents 1000000000)).totalTaxDue
            , test "jump" <| \_ -> Expect.equal "300000015" (generateTaxReport (Money.fromCents 12000000200) Money.zero).totalTaxDue
            , fuzz (Fuzz.intRange 0 100000000) "fz" <| \c -> Expect.equal (Money.fromCents (c * 8000)) (calculateNppnProfit (Money.fromCents c) 1600000)
            ]
        , describe "Progressive Tax Unit Tests"
            [ describe "60M Boundary"
                [ test "exactly 60M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "6000000000")
                        |> Money.toCents
                        |> Expect.equal 300000000
                , test "just below 60M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "5999999900")
                        |> Money.toCents
                        |> Expect.equal 299999995
                , test "just above 60M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "6000000100")
                        |> Money.toCents
                        |> Expect.equal 300000015
                ]
            , describe "250M Boundary"
                [ test "exactly 250M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "25000000000")
                        |> Money.toCents
                        |> Expect.equal 3150000000
                , test "just below 250M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "24999999900")
                        |> Money.toCents
                        |> Expect.equal 3149999985
                , test "just above 250M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "25000000100")
                        |> Money.toCents
                        |> Expect.equal 3150000025
                ]
            , describe "500M Boundary"
                [ test "exactly 500M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "50000000000")
                        |> Money.toCents
                        |> Expect.equal 9400000000
                , test "just below 500M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "49999999900")
                        |> Money.toCents
                        |> Expect.equal 9399999975
                , test "just above 500M" <| \_ ->
                    calculateProgressiveTax defaultBrackets (Money.fromCentsStr "50000000100")
                        |> Money.toCents
                        |> Expect.equal 9400000030
                ]
            ]
        , describe "PPh24 Credit Matrix Tests"
            [ test "foreignTaxPaid < cap" <| \_ ->
                let
                    totalTax = Money.fromCentsStr "900000000" -- 9M IDR
                    foreignIncome = Money.fromCentsStr "4000000000" -- 40M IDR
                    totalIncome = Money.fromCentsStr "10000000000" -- 100M IDR
                    foreignTaxPaid = Money.fromCentsStr "300000000" -- 3M IDR (cap = 3.6M IDR)
                in
                calculatePPh24 totalTax foreignIncome totalIncome foreignTaxPaid
                    |> Money.toCents
                    |> Expect.equal 300000000
            , test "foreignTaxPaid == cap" <| \_ ->
                let
                    totalTax = Money.fromCentsStr "900000000"
                    foreignIncome = Money.fromCentsStr "4000000000"
                    totalIncome = Money.fromCentsStr "10000000000"
                    foreignTaxPaid = Money.fromCentsStr "360000000" -- 3.6M IDR (cap = 3.6M IDR)
                in
                calculatePPh24 totalTax foreignIncome totalIncome foreignTaxPaid
                    |> Money.toCents
                    |> Expect.equal 360000000
            , test "foreignTaxPaid > cap" <| \_ ->
                let
                    totalTax = Money.fromCentsStr "900000000"
                    foreignIncome = Money.fromCentsStr "4000000000"
                    totalIncome = Money.fromCentsStr "10000000000"
                    foreignTaxPaid = Money.fromCentsStr "400000000" -- 4M IDR (cap = 3.6M IDR)
                in
                calculatePPh24 totalTax foreignIncome totalIncome foreignTaxPaid
                    |> Money.toCents
                    |> Expect.equal 360000000
            , test "zero foreign income" <| \_ ->
                let
                    totalTax = Money.fromCentsStr "900000000"
                    foreignIncome = Money.zero
                    totalIncome = Money.fromCentsStr "10000000000"
                    foreignTaxPaid = Money.fromCentsStr "400000000"
                in
                calculatePPh24 totalTax foreignIncome totalIncome foreignTaxPaid
                    |> Money.toCents
                    |> Expect.equal 0
            , test "zero total income" <| \_ ->
                let
                    totalTax = Money.fromCentsStr "900000000"
                    foreignIncome = Money.fromCentsStr "4000000000"
                    totalIncome = Money.zero
                    foreignTaxPaid = Money.fromCentsStr "400000000"
                in
                calculatePPh24 totalTax foreignIncome totalIncome foreignTaxPaid
                    |> Money.toCents
                    |> Expect.equal 0
            ]
        , describe "Aggregation Invariant"
            [ test "aggregated transactions == pre-summed input" <| \_ ->
                let
                    txs = [ { domestic = Money.fromCents 100000, foreign = Money.fromCents 200000 }
                          , { domestic = Money.fromCents 300000, foreign = Money.fromCents 400000 }
                          ]
                    summedIncome =
                        { domestic = List.foldl (\tx acc -> Money.add tx.domestic acc) Money.zero txs
                        , foreign = List.foldl (\tx acc -> Money.add tx.foreign acc) Money.zero txs
                        }
                    taxInput1 = { income = summedIncome, foreignTaxPaid = Money.fromCents 50000 }
                    res1 = calculateTax defaultBrackets taxInput1
                    
                    preSummedIncome = { domestic = Money.fromCents 400000, foreign = Money.fromCents 600000 }
                    taxInput2 = { income = preSummedIncome, foreignTaxPaid = Money.fromCents 50000 }
                    res2 = calculateTax defaultBrackets taxInput2
                in
                Expect.equal res1.totalTax res2.totalTax
            ]
        , describe "Property Fuzz Tests"
            [ fuzz2 (Fuzz.intRange 0 100000000) (Fuzz.intRange 1 100000000) "monotonicity: incomeA < incomeB -> taxA <= taxB" <| \base diff ->
                let
                    incomeA = Money.fromCents base
                    incomeB = Money.fromCents (base + diff)
                    taxA = calculateProgressiveTax defaultBrackets incomeA
                    taxB = calculateProgressiveTax defaultBrackets incomeB
                in
                Expect.atMost (Money.toCents taxB) (Money.toCents taxA)
            , fuzz (Fuzz.intRange 0 500000000) "non-negativity: tax >= 0" <| \c ->
                let
                    income = Money.fromCents c
                    tax = calculateProgressiveTax defaultBrackets income
                in
                Expect.atLeast 0 (Money.toCents tax)
            , fuzz3 (Fuzz.intRange 0 100000000) (Fuzz.intRange 0 100000000) (Fuzz.intRange 0 100000000) "non-negativity: netTax >= 0" <| \dom for wht ->
                let
                    input = { income = { domestic = Money.fromCents dom, foreign = Money.fromCents for }, foreignTaxPaid = Money.fromCents wht }
                    res = calculateTax defaultBrackets input
                in
                Expect.atLeast 0 (Money.toCents res.netTaxPayable)
            , fuzz3 (Fuzz.intRange 0 100000000) (Fuzz.intRange 0 100000000) (Fuzz.intRange 0 100000000) "credit bound: credit <= foreignTaxPaid" <| \dom for wht ->
                let
                    input = { income = { domestic = Money.fromCents dom, foreign = Money.fromCents for }, foreignTaxPaid = Money.fromCents wht }
                    res = calculateTax defaultBrackets input
                in
                Expect.atMost wht (Money.toCents res.pph24Credit)
            ]
        ]
