module TaxExportTest exposing (..)

import DJPCsvExporter
import Expect
import Fuzz
import Money
import Test exposing (Test, describe, fuzz, test)


suite : Test
suite =
    describe "TaxExport"
        [ test "Calculate 5% bracket correctly for 100M gross" <|
            \_ ->
                let
                    gross =
                        Money.fromCents 10000000000

                    -- 100M IDR in cents
                in
                DJPCsvExporter.calculateTax (DJPCsvExporter.calculateNetIncome gross)
                    |> Expect.equal (Money.fromCents 250000000)

        -- Expected 2.5M tax
        , fuzz (Fuzz.intRange 0 1000000000) "calculateTax never returns negative" <|
            \c ->
                Money.fromCents c
                    |> DJPCsvExporter.calculateTax
                    |> Money.toCents
                    |> Expect.atLeast 0
        ]
