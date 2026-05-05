module SPTLogicTests exposing (..)
import Expect
import Money
import TaxLogic
import Test exposing (..)

suite = describe "SPT" [ test "NPPN" <| \_ -> TaxLogic.calculateNppn (Money.fromCents 100000000) |> Expect.equal (Money.fromCents 50000000), test "PPh24" <| \_ -> TaxLogic.calculatePPh24Credit { foreignNetIncome = Money.fromCents 50000000, totalTaxableIncome = Money.fromCents 100000000, totalIndoTaxDue = Money.fromCents 15000000, actualForeignTaxPaid = Money.fromCents 10000000 } |> Expect.equal (Money.fromCents 7500000) ]
