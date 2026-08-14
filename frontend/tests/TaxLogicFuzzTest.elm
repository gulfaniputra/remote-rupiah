module TaxLogicFuzzTest exposing (suite)

import Expect
import Fuzz
import Money
import TaxLogic exposing (defaultBrackets)
import Test exposing (..)


f4 =
    Fuzz.map4 (\a b c d -> { fn = a, tt = b, id = c, fp = d })
        (Fuzz.intRange 0 1000000000)
        (Fuzz.intRange 1 1000000000)
        (Fuzz.intRange 0 1000000000)
        (Fuzz.intRange 0 1000000000)


cr fn tt id fp =
    TaxLogic.calculatePPh24Credit
        { foreignNetIncome = Money.fromCents fn
        , totalTaxableIncome = Money.fromCents (max 1 tt)
        , totalIndoTaxDue = Money.fromCents id
        , actualForeignTaxPaid = Money.fromCents fp
        }


suite : Test
suite =
    describe "TaxLogic Fuzz"
        [ fuzz f4 "credit <= indoTaxDue" <|
            \r -> Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atMost r.id

        , fuzz f4 "credit <= foreignTaxPaid" <|
            \r -> Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atMost r.fp

        , fuzz f4 "credit >= 0" <|
            \r -> Money.toCents (cr (min r.fn r.tt) r.tt r.id r.fp) |> Expect.atLeast 0

        , fuzz f4 "credit <= formula cap" <|
            \r ->
                let
                    foreignIncome =
                        min r.fn r.tt

                    exactFormulaCap =
                        (foreignIncome * r.id) // max 1 r.tt
                in
                Money.toCents (cr foreignIncome r.tt r.id r.fp) |> Expect.atMost exactFormulaCap

        , fuzz (Fuzz.intRange 0 999999999) "NPPN = floor(input/2)" <|
            \c ->
                Money.fromCents c |> TaxLogic.calculateNppn |> Money.toCents |> Expect.equal (c // 2)

        , fuzz (Fuzz.intRange 0 500000000000) "tax >= 0" <|
            \c ->
                Money.fromCents c |> TaxLogic.calculateIndoTax defaultBrackets |> Money.toCents |> Expect.atLeast 0

        , fuzz (Fuzz.intRange 0 500000000000) "tax <= income" <|
            \c ->
                Money.fromCents c |> TaxLogic.calculateIndoTax defaultBrackets |> Money.toCents |> Expect.atMost c

        , fuzz (Fuzz.intRange 1 1000000) "zero leak when actual=expected" <|
            \c ->
                let
                    rateInt =
                        16120

                    e =
                        TaxLogic.calculateIdrValue (Money.fromCents c) rateInt
                in
                TaxLogic.calculateFXLeakage (Money.fromCents c) rateInt e |> Money.toCents |> Expect.equal 0

        , fuzz (Fuzz.intRange 0 6000000000) "projected tax at 60M boundary handles overflow" <|
            \ytd ->
                let
                    projected =
                        TaxLogic.projectYearEndLiability defaultBrackets (Money.fromCents ytd) 12

                    actual =
                        TaxLogic.calculateIndoTax defaultBrackets (TaxLogic.calculateNppn (Money.fromCents ytd))
                in
                Money.toCents projected |> Expect.equal (Money.toCents actual)

        -- NEW TESTS START HERE
        , fuzz
            (Fuzz.map3
                (\a b c -> ( a, b, c ))
                (Fuzz.intRange 0 100000000)
                (Fuzz.intRange 1 1000000)
                (Fuzz.intRange 0 1000000000)
            )
            "calculateFXLeakage is always non-negative"
          <| \( usdCents, rate, actualIdrCents ) ->
                let
                    leak =
                        TaxLogic.calculateFXLeakage
                            (Money.fromCents usdCents)
                            rate
                            (Money.fromCents actualIdrCents)
                in
                Money.toCents leak |> Expect.atLeast 0

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 100000000)
                (Fuzz.intRange 1 1000000)
            )
            "calculateFXLeakage is zero when actual equals expected"
          <| \( usdCents, rate ) ->
                let
                    expectedIdr =
                        TaxLogic.calculateIdrValue (Money.fromCents usdCents) rate

                    leak =
                        TaxLogic.calculateFXLeakage
                            (Money.fromCents usdCents)
                            rate
                            expectedIdr
                in
                Money.toCents leak |> Expect.equal 0

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 500000000)
                (Fuzz.intRange 0 500000000)
            )
            "calculateFinalPayable is never negative"
          <| \( tax, credit ) ->
                let
                    payable =
                        TaxLogic.calculateFinalPayable
                            (Money.fromCents tax)
                            (Money.fromCents credit)
                in
                Money.toCents payable |> Expect.atLeast 0

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 100000000)
                (Fuzz.intRange 100000001 200000000)
            )
            "calculateFinalPayable is zero when credit > tax"
          <| \( tax, credit ) ->
                let
                    payable =
                        TaxLogic.calculateFinalPayable
                            (Money.fromCents tax)
                            (Money.fromCents credit)
                in
                Money.toCents payable |> Expect.equal 0

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 1000000000)
                (Fuzz.intRange 0 100000000)
            )
            "generateTaxReport returns non-negative totalTaxDue"
          <| \( gross, foreignTax ) ->
                let
                    report =
                        TaxLogic.generateTaxReport
                            TaxLogic.defaultBrackets
                            (Money.fromCents gross)
                            (Money.fromCents foreignTax)
                in
                String.toInt report.totalTaxDue
                    |> Maybe.withDefault -1
                    |> Expect.atLeast 0

        , fuzz (Fuzz.intRange 0 1000000000)
            "generateTaxReport with zero foreignTaxPaid is still safe"
          <| \gross ->
                let
                    report =
                        TaxLogic.generateTaxReport
                            TaxLogic.defaultBrackets
                            (Money.fromCents gross)
                            Money.zero
                in
                String.toInt report.totalTaxDue
                    |> Maybe.withDefault -1
                    |> Expect.atLeast 0

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 1000000000)
                (Fuzz.intRange -10 0)
            )
            "projectYearEndLiability returns zero for m <= 0"
          <| \( gross, m ) ->
                TaxLogic.projectYearEndLiability
                    TaxLogic.defaultBrackets
                    (Money.fromCents gross)
                    m
                    |> Money.toCents
                    |> Expect.equal 0

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 1000000000)
                (Fuzz.intRange 1 12)
            )
            "projectYearEndLiability is non-negative for valid m"
          <| \( gross, m ) ->
                TaxLogic.projectYearEndLiability
                    TaxLogic.defaultBrackets
                    (Money.fromCents gross)
                    m
                    |> Money.toCents
                    |> Expect.atLeast 0

        , fuzz (Fuzz.intRange 0 60000000)
            "projectYearEndLiability at 60M with m=12 equals calculateIndoTax on 60M"
          <| \gross ->
                let
                    ytd =
                        Money.fromCents (gross * 100)

                    projected =
                        TaxLogic.projectYearEndLiability
                            TaxLogic.defaultBrackets
                            ytd
                            12

                    annualTax =
                        TaxLogic.calculateIndoTax
                            TaxLogic.defaultBrackets
                            (TaxLogic.calculateNppn ytd)
                in
                Money.toCents projected
                    |> Expect.equal (Money.toCents annualTax)

        -- FIXED: bracket boundary test now generates values near actual boundaries
                   , fuzz
            (Fuzz.oneOf
                [ Fuzz.intRange ((60000000 * 100) - 1000) ((60000000 * 100) + 1000)
                , Fuzz.intRange ((250000000 * 100) - 1000) ((250000000 * 100) + 1000)
                , Fuzz.intRange ((500000000 * 100) - 1000) ((500000000 * 100) + 1000)
                , Fuzz.intRange ((5000000000 * 100) - 1000) ((5000000000 * 100) + 1000)
                ]
            )
            "calculateIndoTax at bracket boundaries is monotonic (tax below <= tax at <= tax above)"
          <| \incomeCents ->
                let
                    income =
                        Money.fromCents incomeCents

                    taxBelow =
                        TaxLogic.calculateIndoTax
                            TaxLogic.defaultBrackets
                            (Money.subtract income (Money.fromCents 1))

                    taxAt =
                        TaxLogic.calculateIndoTax
                            TaxLogic.defaultBrackets
                            income

                    taxAbove =
                        TaxLogic.calculateIndoTax
                            TaxLogic.defaultBrackets
                            (Money.add income (Money.fromCents 1))
                in
                Expect.all
    [ \_ -> Money.toCents taxBelow |> Expect.atMost (Money.toCents taxAt)
    , \_ -> Money.toCents taxAt |> Expect.atMost (Money.toCents taxAbove)
    ]
    ()

        , fuzz
            (Fuzz.map2
                (\a b -> ( a, b ))
                (Fuzz.intRange 0 100000000)
                (Fuzz.intRange 0 100000000)
            )
            "calculatePPh24 returns 0 when totalIncome is 0"
          <| \( foreignIncome, foreignTaxPaid ) ->
                TaxLogic.calculatePPh24
                    (Money.fromCents 50000000) -- totalTax
                    (Money.fromCents foreignIncome)
                    Money.zero -- totalIncome = 0
                    (Money.fromCents foreignTaxPaid)
                    |> Money.toCents
                    |> Expect.equal 0
        ]
