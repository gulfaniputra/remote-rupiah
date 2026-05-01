module TaxLogicFuzzTest exposing (..)

import Expect
import Fuzz
import Money
import TaxLogic exposing (..)
import Test exposing (..)

f4 = Fuzz.map4 (\a b c d -> { fn = a, tt = b, id = c, fp = d }) (Fuzz.intRange 0 1000000000) (Fuzz.intRange 1 1000000000) (Fuzz.intRange 0 1000000000) (Fuzz.intRange 0 1000000000)

cr fn tt id fp = TaxLogic.calculatePPh24Credit
    { foreignNetIncome = Money.fromCents fn, totalTaxableIncome = Money.fromCents (max 1 tt)
    , totalIndoTaxDue = Money.fromCents id, actualForeignTaxPaid = Money.fromCents fp }

suite : Test
suite =
    describe "TaxLogic Fuzz"
        [ fuzz f4 "credit <= indoTaxDue" <| \r -> Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atMost r.id
        , fuzz f4 "credit <= foreignTaxPaid" <| \r -> Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atMost r.fp
        , fuzz f4 "credit >= 0" <| \r -> Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atLeast 0
        , fuzz f4 "credit <= formula cap" <| \r ->
            Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atMost (floor (toFloat (min r.fn r.tt) * toFloat r.id / toFloat (max 1 r.tt)))
        , fuzz (Fuzz.intRange 0 999999999) "NPPN = floor(input/2)" <| \c ->
            Money.fromCents c |> TaxLogic.calculateNPPN |> Money.toCents |> Expect.equal (c // 2)
        , fuzz (Fuzz.intRange 0 500000000000) "tax >= 0" <| \c ->
            Money.fromCents c |> TaxLogic.calculateIndoTax |> Money.toCents |> Expect.atLeast 0
        , fuzz (Fuzz.intRange 0 500000000000) "tax <= income" <| \c ->
            Money.fromCents c |> TaxLogic.calculateIndoTax |> Money.toCents |> Expect.atMost c
        , fuzz (Fuzz.intRange 1 1000000) "zero leak when actual=expected" <| \c ->
            let e = TaxLogic.calculateIdrValue (Money.fromCents c) 1612000 in
            TaxLogic.calculateFXLeakage (Money.fromCents c) 1612000 e |> Money.toCents |> Expect.equal 0
        ]
