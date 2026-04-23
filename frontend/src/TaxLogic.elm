module TaxLogic exposing
    ( calculateFinalPayable
    , calculateFXLeakage
    , calculateIdrValue
    , calculateIndoTax
    , calculateNPPN
    , calculatePPh24Credit
    , calculateUnrealizedGain
    , calculateUsWithholding
    )

{-| TaxLogic module implements the pure Indonesian tax calculation rules for 2026.
Reference: docs/spec.md
-}

import Money exposing (Money)


{-| NPPN (Norma Penghitungan Penghasilan Netto) for Software Developers (KLU 62010) is 50%.
Taxable Profit = Gross_IDR * 0.50
-}
calculateNPPN : Money -> Money
calculateNPPN gross =
    gross
        |> Money.toCents
        |> (\cents -> cents // 2)
        |> Money.fromCents


{-| Indonesian Progressive Tax Brackets (2026):
- 5%  : 0 - 60M
- 15% : 60M - 250M
- 25% : 250M - 500M
- 30% : 500M - 5B
- 35% : > 5B
-}
calculateIndoTax : Money -> Money
calculateIndoTax taxableIncome =
    let
        cents =
            Money.toCents taxableIncome

        -- Brackets in cents (1 IDR = 100 cents for consistent Money usage)
        b1 =
            60000000 * 100

        b2 =
            250000000 * 100

        b3 =
            500000000 * 100

        b4 =
            5000000000 * 100

        tax =
            if cents <= b1 then
                cents * 5 // 100

            else if cents <= b2 then
                (b1 * 5 // 100) + (cents - b1) * 15 // 100

            else if cents <= b3 then
                (b1 * 5 // 100)
                    + ((b2 - b1) * 15 // 100)
                    + ((cents - b2) * 25 // 100)

            else if cents <= b4 then
                (b1 * 5 // 100)
                    + ((b2 - b1) * 15 // 100)
                    + ((b3 - b2) * 25 // 100)
                    + ((cents - b3) * 30 // 100)

            else
                (b1 * 5 // 100)
                    + ((b2 - b1) * 15 // 100)
                    + ((b3 - b2) * 25 // 100)
                    + ((b4 - b3) * 30 // 100)
                    + ((cents - b4) * 35 // 100)
    in
    Money.fromCents tax


{-| PPh 24 (Foreign Tax Credit) Cap formula.
CreditLimit = (ForeignNetIncome / TotalTaxableIncome) * TotalIndonesianTaxDue

The rule is the LESSER of:
1. Actual US Tax Paid (10% via W-8BEN)
2. The formula cap
3. Total Indonesian Tax Due
-}
calculatePPh24Credit :
    { foreignNetIncome : Money
    , totalTaxableIncome : Money
    , totalIndoTaxDue : Money
    , actualForeignTaxPaid : Money
    }
    -> Money
calculatePPh24Credit params =
    let
        fn =
            Money.toCents params.foreignNetIncome

        tt =
            Money.toCents params.totalTaxableIncome

        it =
            Money.toCents params.totalIndoTaxDue

        aft =
            Money.toCents params.actualForeignTaxPaid

        -- Formula: (ForeignNet / TotalTaxable) * TotalIndoTax
        -- We multiply first to maintain precision before integer division
        cap =
            if tt == 0 then
                0

            else
                (fn * it) // tt

        credit =
            min aft (min cap it)
    in
    Money.fromCents credit


{-| US Withholding is typically 10% for Indonesian residents via W-8BEN treaty.
-}
calculateUsWithholding : Money -> Money
calculateUsWithholding gross =
    gross
        |> Money.toCents
        |> (\cents -> cents * 10 // 100)
        |> Money.fromCents


{-| Final payable to DJP = Total Indonesian Tax - PPh 24 Credit
-}
calculateFinalPayable : Money -> Money -> Money
calculateFinalPayable totalTax pph24Credit =
    Money.subtract totalTax pph24Credit


{-| Calculate IDR value from USD amount and KMK rate.
KMK Rate is expected as an Int scaled by 100 (e.g. 1612000 for 16,120.00).
USD Amount is Money (cents).
1 USD = 100 USD cents.
IDR Amount (in IDR cents) = (USD cents / 100) * KMK rate
Since USD cents / 100 gives USD dollars, and KMK rate is IDR/USD * 100.
IDR cents = (USD cents * KMK rate) // 100
-}
calculateIdrValue : Money -> Int -> Money
calculateIdrValue usdAmount kmkRateScaled =
    usdAmount
        |> Money.toCents
        |> (\usdCents -> (usdCents * kmkRateScaled) // 100)
        |> Money.fromCents


{-| FX Leakage = (USD * Mid-Market Rate) - Actual IDR Received
Rates are scaled by 100.
-}
calculateFXLeakage : Money -> Int -> Money -> Money
calculateFXLeakage usdAmount midMarketRateScaled actualIdrReceived =
    let
        expectedIdr =
            calculateIdrValue usdAmount midMarketRateScaled
    in
    Money.subtract expectedIdr actualIdrReceived


{-| Unrealized Gain/Loss = (USD Balance * Current Rate) - (USD Balance * Cost Basis Rate)
Rates are scaled by 100.
-}
calculateUnrealizedGain : Money -> Int -> Int -> Money
calculateUnrealizedGain usdBalance currentRateScaled costBasisRateScaled =
    let
        currentValue =
            calculateIdrValue usdBalance currentRateScaled

        costBasisValue =
            calculateIdrValue usdBalance costBasisRateScaled
    in
    Money.subtract currentValue costBasisValue
