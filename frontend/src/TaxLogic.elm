module TaxLogic exposing
    ( AnnualIncome
    , PPh24Params
    , TaxBracket
    , TaxInput
    , TaxResult
    , aggregateAnnualSummary
    , calculateFinalPayable
    , calculateFXLeakage
    , calculateIdrValue
    , calculateIndoTax
    , calculateNppn
    , calculateNppnProfit
    , calculatePPh24
    , calculatePPh24Credit
    , calculateProgressiveTax
    , calculateTax
    , calculateUsWithholding
    , defaultBrackets
    , generateTaxReport
    , minMoney
    , nonNegative
    , projectYearEndLiability
    )

import Money exposing (IDR, Money)


type alias AnnualIncome =
    { domestic : Money IDR
    , foreign : Money IDR
    }


type alias TaxInput =
    { income : AnnualIncome
    , foreignTaxPaid : Money IDR
    }


type alias TaxResult =
    { totalTax : Money IDR
    , pph24Credit : Money IDR
    , netTaxPayable : Money IDR
    }


type alias Rate =
    Int


type alias TaxBracket =
    { lower : Money IDR
    , upper : Maybe (Money IDR)
    , rate : Rate
    }


type alias PPh24Params =
    { foreignNetIncome : Money IDR, totalTaxableIncome : Money IDR, totalIndoTaxDue : Money IDR, actualForeignTaxPaid : Money IDR }


nonNegative : Money c -> Money c
nonNegative amount =
    if Money.compare amount Money.zero == LT then
        Money.zero

    else
        amount


calculateNppn : Money IDR -> Money IDR
calculateNppn m =
    Money.divide (Money.multiply m 50) 100


calculatePPh24Credit : PPh24Params -> Money IDR
calculatePPh24Credit p =
    calculatePPh24 p.totalIndoTaxDue p.foreignNetIncome p.totalTaxableIncome p.actualForeignTaxPaid


calculateIndoTax : Money IDR -> Money IDR
calculateIndoTax =
    calculateProgressiveTax defaultBrackets


aggregateAnnualSummary txs =
    let
        gross =
            List.foldl (\tx acc -> Money.add tx.gross acc) Money.zero txs

        netIncome =
            calculateNppn gross

        indoTaxDue =
            calculateIndoTax netIncome

        foreignTaxPaid =
            List.foldl (\tx acc -> Money.add tx.foreignTaxPaid acc) Money.zero txs

        pph24Credit =
            calculatePPh24Credit
                { foreignNetIncome = netIncome
                , totalTaxableIncome = netIncome
                , totalIndoTaxDue = indoTaxDue
                , actualForeignTaxPaid = foreignTaxPaid
                }
    in
    { totalGross = gross
    , totalNetIncome = netIncome
    , totalPPh24Credit = pph24Credit
    , totalIndoTaxDue = indoTaxDue
    , finalTaxPayable = nonNegative (Money.subtract indoTaxDue pph24Credit)
    }


projectYearEndLiability g m =
    if m <= 0 then
        Money.zero

    else
        calculateIndoTax (Money.divide (Money.multiply g 12) m)


defaultBrackets : List TaxBracket
defaultBrackets =
    [ { lower = Money.zero
      , upper = Just (Money.fromCentsStr "6000000000")
      , rate = 500
      }
    , { lower = Money.fromCentsStr "6000000000"
      , upper = Just (Money.fromCentsStr "25000000000")
      , rate = 1500
      }
    , { lower = Money.fromCentsStr "25000000000"
      , upper = Just (Money.fromCentsStr "50000000000")
      , rate = 2500
      }
    , { lower = Money.fromCentsStr "50000000000"
      , upper = Just (Money.fromCentsStr "500000000000")
      , rate = 3000
      }
    , { lower = Money.fromCentsStr "500000000000"
      , upper = Nothing
      , rate = 3500
      }
    ]


minMoney : Money c -> Money c -> Money c
minMoney a b =
    case Money.compare a b of
        LT ->
            a

        _ ->
            b


maxMoney : Money c -> Money c -> Money c
maxMoney a b =
    case Money.compare a b of
        GT ->
            a

        _ ->
            b


sortBrackets : List TaxBracket -> List TaxBracket
sortBrackets =
    List.sortWith (\x y -> Money.compare x.lower y.lower)


calculateProgressiveTax : List TaxBracket -> Money IDR -> Money IDR
calculateProgressiveTax brackets income =
    List.foldl
        (\bracket acc ->
            let
                limit =
                    case bracket.upper of
                        Just upper ->
                            minMoney income upper

                        Nothing ->
                            income
            in
            Money.add acc (Money.divide (Money.multiply (maxMoney Money.zero (Money.subtract limit bracket.lower)) bracket.rate) 10000)
        )
        Money.zero
        (sortBrackets brackets)


calculatePPh24 : Money IDR -> Money IDR -> Money IDR -> Money IDR -> Money IDR
calculatePPh24 totalTax foreignIncome totalIncome foreignTaxPaid =
    if Money.compare totalIncome Money.zero == EQ || Money.compare foreignIncome Money.zero == EQ then
        Money.zero

    else
        minMoney foreignTaxPaid (Money.proportion totalTax foreignIncome totalIncome)


calculateTax : List TaxBracket -> TaxInput -> TaxResult
calculateTax brackets input =
    let
        totalIncome =
            Money.add input.income.domestic input.income.foreign

        totalTax =
            calculateProgressiveTax brackets totalIncome

        pph24Credit =
            calculatePPh24 totalTax input.income.foreign totalIncome input.foreignTaxPaid
    in
    { totalTax = totalTax
    , pph24Credit = pph24Credit
    , netTaxPayable = nonNegative (Money.subtract totalTax pph24Credit)
    }


calculateUsWithholding : Money IDR -> Money IDR
calculateUsWithholding gross =
    Money.divide (Money.multiply gross 10) 100


calculateIdrValue : Money c -> Int -> Money IDR
calculateIdrValue usdCents rate =
    Money.divide (Money.multiply usdCents rate) 100


calculateNppnProfit : Money IDR -> Int -> Money IDR
calculateNppnProfit gross rate =
    calculateNppn (calculateIdrValue gross rate)


calculateFXLeakage : Money c -> Int -> Money IDR -> Money IDR
calculateFXLeakage usdCents rate actualIdr =
    let
        expectedIdr =
            calculateIdrValue usdCents rate
    in
    -- Absolute difference, always non-negative
    nonNegative (Money.subtract expectedIdr actualIdr)


calculateFinalPayable : Money IDR -> Money IDR -> Money IDR
calculateFinalPayable totalTax credit =
    nonNegative (Money.subtract totalTax credit)


generateTaxReport : Money IDR -> Money IDR -> { totalTaxDue : String }
generateTaxReport totalForeignGross foreignTaxPaid =
    let
        taxableIncome =
            calculateNppn totalForeignGross

        indoTaxDue =
            calculateIndoTax taxableIncome

        pph24Credit =
            calculatePPh24Credit
                { foreignNetIncome = taxableIncome
                , totalTaxableIncome = taxableIncome
                , totalIndoTaxDue = indoTaxDue
                , actualForeignTaxPaid = foreignTaxPaid
                }

        finalPayable =
            calculateFinalPayable indoTaxDue pph24Credit
    in
    { totalTaxDue = Money.toAuthoritativeString finalPayable }
