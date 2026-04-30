module TaxLogicTests exposing (..)
import Expect
import Fuzz
import Money exposing (Money)
import TaxLogic exposing (..)
import Test exposing (..)

b : List TaxBracket
b = [ { threshold = Money.fromCents 6000000000, rate = 0.05 }, { threshold = Money.fromCents 25000000000, rate = 0.15 }, { threshold = Money.fromCents 50000000000, rate = 0.25 }, { threshold = Money.fromCents 500000000000, rate = 0.30 }, { threshold = Money.fromCents 999999999999999, rate = 0.35 } ]

suite : Test
suite =
    describe "Engine"
        [ fuzz Fuzz.int "net bounds" (\r -> Expect.equal True (Money.toCents (TaxLogic.netIncomeFromBruto (Money.fromCents (abs r))) >= 0))
        , fuzz Fuzz.int "tax bounds" (\r -> Expect.equal True (Money.toCents (TaxLogic.calculatePPhTerutang b (Money.fromCents (min (abs r) 9000000000000))) >= 0))
        , test "A" (\_ -> Expect.equal (Ok (Money.fromCents 10000000000)) (TaxLogic.calculatePPh24CreditSync { foreignNet = Money.fromCents 100000000000, totalTaxable = Money.fromCents 100000000000, totalTaxDue = Money.fromCents 24400000000, foreignTaxPaid = Money.fromCents 10000000000 }))
        , test "B" (\_ -> Expect.equal (Ok (Money.fromCents 1000000000)) (TaxLogic.calculatePPh24CreditSync { foreignNet = Money.fromCents 20000000000, totalTaxable = Money.fromCents 10000000000, totalTaxDue = Money.fromCents 500000000, foreignTaxPaid = Money.fromCents 2000000000 }))
        , test "C1" (\_ -> Expect.equal (Err "Invalid Taxable Base") (TaxLogic.calculatePPh24CreditSync { foreignNet = Money.fromCents 10000000000, totalTaxable = Money.zero, totalTaxDue = Money.zero, foreignTaxPaid = Money.fromCents 1000000000 }))
        , test "C2" (\_ -> Expect.equal Money.zero (TaxLogic.calculatePPhTerutang b Money.zero))
        , test "C3" (\_ -> Expect.equal (Money.fromCents 319400000000) (TaxLogic.calculatePPhTerutang b (Money.fromCents 1000000000000)))
        ]
