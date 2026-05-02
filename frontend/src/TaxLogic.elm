module TaxLogic exposing (..)
import Money exposing (Money)

type alias TaxBracket = { threshold : Money, rate : Int }

calculatePPhTerutang : List TaxBracket -> Money -> Money
calculatePPhTerutang b m = Tuple.second <| List.foldl (\bk (p, a) -> (bk.threshold, Money.add a (Money.divide (Money.multiply (Money.fromCents (max 0 (min (Money.toCents bk.threshold - Money.toCents p) (Money.toCents m - Money.toCents p)))) bk.rate) 100))) (Money.zero, Money.zero) b

calculatePPh24Credit : { foreignNetIncome : Money, totalTaxableIncome : Money, totalIndoTaxDue : Money, actualForeignTaxPaid : Money } -> Money
calculatePPh24Credit p = 
    if Money.toCents p.totalTaxableIncome <= 0 || Money.toCents p.foreignNetIncome < 0 then Money.zero 
    else Money.fromCents <| min (Money.toCents p.actualForeignTaxPaid) (Money.toCents (Money.proportion p.foreignNetIncome p.totalIndoTaxDue p.totalTaxableIncome))

calculateUsWithholding b = Money.divide b 10
calculateIdrValue m r = Money.divide (Money.multiply m r) 100
calculateFinalPayable = Money.subtract
calculateFXLeakage m r act = Money.subtract (calculateIdrValue m r) act
calculateUnrealizedGain m r1 r2 = Money.subtract (calculateIdrValue m r1) (calculateIdrValue m r2)
calculateNPPN b = Money.divide (Money.multiply b 50) 100

indoBrackets2026 = [ { threshold = Money.fromCents 6000000000, rate = 5 }, { threshold = Money.fromCents 25000000000, rate = 15 }, { threshold = Money.fromCents 50000000000, rate = 25 }, { threshold = Money.fromCents 500000000000, rate = 30 }, { threshold = Money.fromCents 999999999999999, rate = 35 } ]

calculateIndoTax = calculatePPhTerutang indoBrackets2026
