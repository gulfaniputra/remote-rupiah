module TaxLogic exposing (..)
import Money exposing (Money)

type alias TaxBracket = { threshold : Money, rate : Int }

netIncomeFromBruto : Money -> Money
netIncomeFromBruto b = Money.fromCents (floor (toFloat (Money.toCents b) / 2))

calculatePPhTerutang : List TaxBracket -> Money -> Money
calculatePPhTerutang brackets tMoney =
    let c b p a = case b of
            [] -> a
            bk :: r -> c r (Money.toCents bk.threshold) (a + floor (toFloat (max 0 (min (Money.toCents bk.threshold - p) (Money.toCents tMoney - p))) * toFloat bk.rate / 100))
    in Money.fromCents (c brackets 0 0)

calculatePPh24CreditSync : { foreignNet : Money, totalTaxable : Money, totalTaxDue : Money, foreignTaxPaid : Money } -> Result String Money
calculatePPh24CreditSync p =
    if Money.toCents p.totalTaxable <= 0 || Money.toCents p.foreignNet < 0 then Err "Invalid Taxable Base"
    else Ok <| Money.fromCents <| min (Money.toCents p.foreignTaxPaid) <| floor (toFloat (Money.toCents p.foreignNet) * toFloat (Money.toCents p.totalTaxDue) / toFloat (Money.toCents p.totalTaxable))

calculatePPh24Credit : { foreignNetIncome : Money, totalTaxableIncome : Money, totalIndoTaxDue : Money, actualForeignTaxPaid : Money } -> Money
calculatePPh24Credit p =
    case calculatePPh24CreditSync { foreignNet = p.foreignNetIncome, totalTaxable = p.totalTaxableIncome, totalTaxDue = p.totalIndoTaxDue, foreignTaxPaid = p.actualForeignTaxPaid } of
        Ok m -> m
        Err _ -> Money.fromCents 0

calculateUsWithholding : Money -> Money
calculateUsWithholding b = Money.fromCents (floor (toFloat (Money.toCents b) / 10))

calculateFinalPayable : Money -> Money -> Money
calculateFinalPayable = Money.subtract

calculateIdrValue : Money -> Int -> Money
calculateIdrValue m r = Money.fromCents (floor (toFloat (Money.toCents m) * toFloat r / 100))

calculateFXLeakage : Money -> Int -> Money -> Money
calculateFXLeakage m r act = Money.subtract (calculateIdrValue m r) act

calculateUnrealizedGain : Money -> Int -> Int -> Money
calculateUnrealizedGain m r1 r2 = Money.subtract (calculateIdrValue m r1) (calculateIdrValue m r2)

indoBrackets2026 : List TaxBracket
indoBrackets2026 =
    [ { threshold = Money.fromCents 6000000000, rate = 5 }
    , { threshold = Money.fromCents 25000000000, rate = 15 }
    , { threshold = Money.fromCents 50000000000, rate = 25 }
    , { threshold = Money.fromCents 500000000000, rate = 30 }
    , { threshold = Money.fromCents 999999999999999, rate = 35 }
    ]

calculateIndoTax : Money -> Money
calculateIndoTax = calculatePPhTerutang indoBrackets2026

calculateNPPN : Money -> Money
calculateNPPN = netIncomeFromBruto
