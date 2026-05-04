module TaxLogic exposing (..)

import Money exposing (Money)


type alias TaxBracket =
    { threshold : Money Money.IDR, rate : Int }


type alias BracketHit =
    { rate : Float, taxableAmountInBracket : Int, taxCents : Int }


type alias CalculationProof =
    { nppnRate : Float, grossIdr : Int, taxableProfitIdr : Int, bracketBreakdown : List BracketHit, pph24Logic : String }


type alias TaxReport =
    { totalTaxDue : Int, proof : CalculationProof }


calculatePPhTerutang : List TaxBracket -> Money Money.IDR -> Money Money.IDR
calculatePPhTerutang brackets m =
    Tuple.second <| List.foldl (\bk ( p, a ) -> ( bk.threshold, Money.add a (Money.divide (Money.multiply (Money.fromCents (max 0 (min (Money.toCents bk.threshold - Money.toCents p) (Money.toCents m - Money.toCents p)))) bk.rate) 100) )) ( Money.zero, Money.zero ) brackets


calculateProgressiveWithProof : List TaxBracket -> Money Money.IDR -> ( Int, List BracketHit )
calculateProgressiveWithProof brackets income =
    List.foldl (\b ( p, t, h ) -> let tc = Money.toCents b.threshold in let tab = max 0 (min (tc - p) (Money.toCents income - p)) in let bc = Money.toCents (Money.divide (Money.multiply (Money.fromCents tab) b.rate) 100) in ( tc, t + bc, if tab > 0 then h ++ [ { rate = toFloat b.rate / 100, taxableAmountInBracket = tab, taxCents = bc } ] else h )) ( 0, 0, [] ) brackets |> (\( _, t, h ) -> ( t, h ))


calculateUsWithholding b =
    Money.divide b 10


calculateIdrValue m r =
    Money.proportion m (Money.fromCents r) (Money.fromCents 100)


calculateNppnProfit m r =
    Money.divide (calculateIdrValue m r) 2


calculatePPh24Credit p =
    let
        ( fi, ti, td ) =
            ( p.foreignNetIncome, p.totalTaxableIncome, p.totalIndoTaxDue )

        cap =
            Money.proportion td fi ti
    in
    Money.fromCents (min (Money.toCents p.actualForeignTaxPaid) (Money.toCents cap))


calculateNPPN b =
    Money.divide b 2


indoBrackets2026 =
    [ { threshold = Money.fromCents 6000000000, rate = 5 }, { threshold = Money.fromCents 25000000000, rate = 15 }, { threshold = Money.fromCents 50000000000, rate = 25 }, { threshold = Money.fromCents 500000000000, rate = 30 }, { threshold = Money.fromCents 999999999999999, rate = 35 } ]


calculateIndoTax =
    calculatePPhTerutang indoBrackets2026


calculateFXLeakage m r a =
    Money.subtract (calculateIdrValue m r) a


calculateFinalPayable t c =
    Money.fromCents (max 0 (Money.toCents t - Money.toCents c))


generateTaxReport grossIdr foreignTaxPaidInIdr =
    let
        tp =
            calculateNPPN grossIdr

        ( gt, bb ) =
            calculateProgressiveWithProof indoBrackets2026 tp

        c =
            Money.toCents (calculatePPh24Credit { foreignNetIncome = tp, totalTaxableIncome = tp, totalIndoTaxDue = Money.fromCents gt, actualForeignTaxPaid = foreignTaxPaidInIdr })
    in
    { totalTaxDue = max 0 (gt - c)
    , proof = { nppnRate = 0.5, grossIdr = Money.toCents grossIdr, taxableProfitIdr = Money.toCents tp, bracketBreakdown = bb, pph24Logic = "Capped at PPh 24 Ceiling: min(Foreign Tax Paid, (" ++ String.fromInt (Money.toCents tp) ++ " / " ++ String.fromInt (Money.toCents tp) ++ ") * " ++ String.fromInt gt ++ ")" }
    }
