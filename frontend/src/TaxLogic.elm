module TaxLogic exposing (..)
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

type alias Rate = Int

type alias TaxBracket =
    { lower : Money IDR
    , upper : Maybe (Money IDR)
    , rate : Rate
    }

type alias PPh24Params = { foreignNetIncome : Money IDR, totalTaxableIncome : Money IDR, totalIndoTaxDue : Money IDR, actualForeignTaxPaid : Money IDR }

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
        g =
            List.foldl (\tx a -> Money.add tx.gross a) Money.zero txs

        n =
            calculateNppn g

        t =
            calculateIndoTax n

        f =
            List.foldl (\tx a -> Money.add tx.foreignTaxPaid a) Money.zero txs

        c =
            calculatePPh24Credit
                { foreignNetIncome = n
                , totalTaxableIncome = n
                , totalIndoTaxDue = t
                , actualForeignTaxPaid = f
                }
    in
    { totalGross = g
    , totalNetIncome = n
    , totalPPh24Credit = c
    , totalIndoTaxDue = t
    , finalTaxPayable =
        Money.subtract t c
            |> (\m ->
                    if Money.compare m Money.zero == LT then
                        Money.zero

                    else
                        m
               )
    }


projectYearEndLiability g m =
    if m <= 0 then
        Money.zero

    else
        calculateIndoTax (Money.divide (Money.multiply g 12) m)


-- Legacy/Helper API Compatibility
calculateNPPN =
    calculateNppn


calculateUsWithholding m =
    Money.divide m 10


calculateIdrValue m r =
    Money.divide (Money.multiply m r) 100


calculateNppnProfit m r =
    calculateNppn (calculateIdrValue m r)


calculateFXLeakage m r act =
    Money.subtract (calculateIdrValue m r) act


calculateFinalPayable t c =
    Money.subtract t c
        |> (\m ->
                if Money.compare m Money.zero == LT then
                    Money.zero

                else
                    m
           )


generateTaxReport g f =
    let
        s =
            aggregateAnnualSummary [ { gross = g, foreignTaxPaid = f } ]
    in
    { totalTaxDue = Money.toAuthoritativeString s.finalTaxPayable
    , proof =
        { nppnBasisPoints = 5000
        , grossIdr = Money.toAuthoritativeString s.totalGross
        , taxableProfitIdr = Money.toAuthoritativeString s.totalNetIncome
        , bracketBreakdown = []
        , pph24Logic = "min"
        }
    }


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
    let
        calcBracket bracket acc =
            let
                limit =
                    case bracket.upper of
                        Just u ->
                            minMoney income u

                        Nothing ->
                            income

                taxable =
                    maxMoney Money.zero (Money.subtract limit bracket.lower)
            in
            Money.add acc (Money.divide (Money.multiply taxable bracket.rate) 10000)
    in
    List.foldl calcBracket Money.zero (sortBrackets brackets)


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
    in
    { totalTax = totalTax
    , pph24Credit = calculatePPh24 totalTax input.income.foreign totalIncome input.foreignTaxPaid
    , netTaxPayable = maxMoney Money.zero (Money.subtract totalTax (calculatePPh24 totalTax input.income.foreign totalIncome input.foreignTaxPaid))
    }
