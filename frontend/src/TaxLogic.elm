module TaxLogic exposing (..)
import Money exposing (Money)

calculateNPPN : Money -> Money
calculateNPPN = Money.toCents >> (\c -> c // 2) >> Money.fromCents

calculateIndoTax : Money -> Money
calculateIndoTax taxable =
    let c = Money.toCents taxable
        (b1, b2, b3, b4) = (6000000000, 25000000000, 50000000000, 500000000000)
    in Money.fromCents <|
        if c <= b1 then c * 5 // 100
        else if c <= b2 then 300000000 + (c - b1) * 15 // 100
        else if c <= b3 then 3150000000 + (c - b2) * 25 // 100
        else if c <= b4 then 9400000000 + (c - b3) * 30 // 100
        else 144400000000 + (c - b4) * 35 // 100

calculatePPh24Credit : { foreignNetIncome : Money, totalTaxableIncome : Money, totalIndoTaxDue : Money, actualForeignTaxPaid : Money } -> Money
calculatePPh24Credit p =
    let (fn, it, tt, aft) = (Money.toCents p.foreignNetIncome, Money.toCents p.totalIndoTaxDue, Money.toCents p.totalTaxableIncome, Money.toCents p.actualForeignTaxPaid)
        cap = if tt == 0 then 0 else (fn * it) // tt
    in Money.fromCents (min aft (min cap it))

calculateUsWithholding : Money -> Money
calculateUsWithholding = Money.toCents >> (\c -> c * 10 // 100) >> Money.fromCents

calculateFinalPayable : Money -> Money -> Money
calculateFinalPayable = Money.subtract

calculateIdrValue : Money -> Int -> Money
calculateIdrValue m r = Money.fromCents ((Money.toCents m * r) // 100)

calculateFXLeakage : Money -> Int -> Money -> Money
calculateFXLeakage m r actual = Money.subtract (calculateIdrValue m r) actual

calculateUnrealizedGain : Money -> Int -> Int -> Money
calculateUnrealizedGain m r1 r2 = Money.subtract (calculateIdrValue m r1) (calculateIdrValue m r2)

