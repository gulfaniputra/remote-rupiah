module TaxExportTest exposing (..)

import Expect
import Test exposing (Test, test, describe, fuzz)
import Fuzz
import Money
import DJPCsvExporter

suite : Test
suite =
    describe "TaxExport"
        [ test "Calculate 5% bracket correctly for 100M gross" <|
            \_ ->
                let
                    gross = Money.fromCents 10000000000 -- 100M IDR in cents
                in
                DJPCsvExporter.calculateTax (DJPCsvExporter.calculateNetIncome gross)
                    |> Expect.equal (Money.fromCents 250000000) -- Expected 2.5M tax
        , fuzz (Fuzz.intRange 0 1000000000) "calculateTax never returns negative" <|
            \c ->
                Money.fromCents c
                    |> DJPCsvExporter.calculateTax
                    |> Money.toCents
                    |> Expect.atLeast 0
        ]
