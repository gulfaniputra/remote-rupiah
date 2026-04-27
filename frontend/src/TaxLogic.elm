module TaxLogic exposing (..)
import Money exposing (Money)

type alias TaxBracket = { threshold : Money, rate : Float }

netIncomeFromBruto : Money -> Money
netIncomeFromBruto b = Money.fromCents (Money.toCents b // 2)

calculatePPhTerutang : List TaxBracket -> Money -> Money
calculatePPhTerutang brackets tMoney =
    let c b p a = case b of
            [] -> a
            bk :: r -> c r (Money.toCents bk.threshold) (a + floor (toFloat (max 0 (min (Money.toCents bk.threshold - p) (Money.toCents tMoney - p))) * bk.rate))
    in Money.fromCents (c brackets 0 0)

calculatePPh24Credit : { foreignNet : Money, totalTaxable : Money, totalTaxDue : Money, foreignTaxPaid : Money } -> Result String Money
calculatePPh24Credit p =
    if Money.toCents p.totalTaxable <= 0 || Money.toCents p.foreignNet < 0 then Err "Invalid Taxable Base"
    else Ok <| Money.fromCents <| min (Money.toCents p.foreignTaxPaid) <| floor <| toFloat (Money.toCents p.foreignNet) / toFloat (Money.toCents p.totalTaxable) * toFloat (Money.toCents p.totalTaxDue)

calculateUsWithholding : Money -> Money
calculateUsWithholding b = Money.fromCents (Money.toCents b // 10)

calculateFinalPayable : Money -> Money -> Money
calculateFinalPayable = Money.subtract

calculateIdrValue : Money -> Int -> Money
calculateIdrValue m r = Money.fromCents (Money.toCents m * r // 100)

calculateFXLeakage : Money -> Int -> Money -> Money
calculateFXLeakage m r act = Money.subtract (calculateIdrValue m r) act

calculateUnrealizedGain : Money -> Int -> Int -> Money
calculateUnrealizedGain m r1 r2 = Money.subtract (calculateIdrValue m r1) (calculateIdrValue m r2)
