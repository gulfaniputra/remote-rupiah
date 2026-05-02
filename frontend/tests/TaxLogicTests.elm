module TaxLogicTests exposing (..)
import Expect
import Fuzz
import Money exposing (Money)
import TaxLogic exposing (..)
import Test exposing (..)

b : List TaxBracket
b = [ { threshold = Money.fromCents 6000000000, rate = 5 }, { threshold = Money.fromCents 25000000000, rate = 15 }, { threshold = Money.fromCents 50000000000, rate = 25 }, { threshold = Money.fromCents 500000000000, rate = 30 }, { threshold = Money.fromCents 999999999999999, rate = 35 } ]

suite : Test
suite =
    describe "Engine"
        [ fuzz Fuzz.int "net bounds" (\r -> Expect.equal True (Money.toCents (TaxLogic.calculateNPPN (Money.fromCents (abs r))) >= 0))
        , fuzz Fuzz.int "tax bounds" (\r -> Expect.equal True (Money.toCents (TaxLogic.calculatePPhTerutang b (Money.fromCents (min (abs r) 9000000000000))) >= 0))
        , test "A" (\_ -> Expect.equal (Money.fromCents 10000000000) (TaxLogic.calculatePPh24Credit { foreignNetIncome = Money.fromCents 100000000000, totalTaxableIncome = Money.fromCents 100000000000, totalIndoTaxDue = Money.fromCents 24400000000, actualForeignTaxPaid = Money.fromCents 10000000000 }))
        , test "B" (\_ -> Expect.equal (Money.fromCents 1000000000) (TaxLogic.calculatePPh24Credit { foreignNetIncome = Money.fromCents 20000000000, totalTaxableIncome = Money.fromCents 10000000000, totalIndoTaxDue = Money.fromCents 500000000, actualForeignTaxPaid = Money.fromCents 2000000000 }))
        , test "C1" (\_ -> Expect.equal Money.zero (TaxLogic.calculatePPh24Credit { foreignNetIncome = Money.fromCents 10000000000, totalTaxableIncome = Money.zero, totalIndoTaxDue = Money.zero, actualForeignTaxPaid = Money.fromCents 1000000000 }))
        , test "C2" (\_ -> Expect.equal Money.zero (TaxLogic.calculatePPhTerutang b Money.zero))
        , test "C3" (\_ -> Expect.equal (Money.fromCents 319400000000) (TaxLogic.calculatePPhTerutang b (Money.fromCents 1000000000000)))
        ]
