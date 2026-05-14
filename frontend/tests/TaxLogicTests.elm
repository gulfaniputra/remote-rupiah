module TaxLogicTests exposing (..)

import Expect
import Fuzz
import Money exposing (Money)
import TaxLogic exposing (..)
import Test exposing (..)


suite : Test
suite =
    describe "Tax"
        [ test "nppn" <| \_ -> Expect.equal (Money.fromCents 817500000) (calculateNppnProfit (Money.fromCents 100000) 1635000)
        , test "pph24" <| \_ -> Expect.equal (Money.fromCents 1000000000) (calculatePPh24Credit { foreignNetIncome = Money.fromCents 10000000000, totalTaxableIncome = Money.fromCents 20000000000, totalIndoTaxDue = Money.fromCents 2000000000, actualForeignTaxPaid = Money.fromCents 1500000000 })
        , test "neg" <| \_ -> Expect.equal "0" (generateTaxReport (Money.fromCents -10000) Money.zero).totalTaxDue
        , test "cap" <| \_ -> Expect.equal "0" (generateTaxReport (Money.fromCents 20000000000) (Money.fromCents 1000000000)).totalTaxDue
        , test "jump" <| \_ -> Expect.equal "300000015" (generateTaxReport (Money.fromCents 12000000200) Money.zero).totalTaxDue
        , fuzz (Fuzz.intRange 0 100000000) "fz" <| \c -> Expect.equal (Money.fromCents (c * 8000)) (calculateNppnProfit (Money.fromCents c) 1600000)
        ]
