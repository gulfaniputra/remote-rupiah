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
    List.foldl (\b ( p, t, h ) -> let tc = Money.toCents b.threshold in let tab = max 0 (min (tc - p) (Money.toCents income - p)) in let bc = (tab * b.rate) // 100 in ( tc, t + bc, if tab > 0 then h ++ [ { rate = toFloat b.rate / 100, taxableAmountInBracket = tab, taxCents = bc } ] else h )) ( 0, 0, [] ) brackets |> (\( _, t, h ) -> ( t, h ))


calculateUsWithholding : Money Money.USD -> Money Money.USD
calculateUsWithholding b = Money.divide b 10


calculateIdrValue : Money Money.USD -> Int -> Money Money.IDR
calculateIdrValue m r = Money.fromCents (Money.toCents (Money.multiply m r) // 100)


calculateNPPN : Money Money.IDR -> Money Money.IDR
calculateNPPN b = Money.divide (Money.multiply b 50) 100


indoBrackets2026 : List TaxBracket
indoBrackets2026 =
    [ { threshold = Money.fromCents 6000000000, rate = 5 }, { threshold = Money.fromCents 25000000000, rate = 15 }, { threshold = Money.fromCents 50000000000, rate = 25 }, { threshold = Money.fromCents 500000000000, rate = 30 }, { threshold = Money.fromCents 999999999999999, rate = 35 } ]


generateTaxReport : Money Money.IDR -> Money Money.IDR -> TaxReport
generateTaxReport grossIdr foreignTaxPaidInIdr =
    let tp = calculateNPPN grossIdr in
    let ( gt, bb ) = calculateProgressiveWithProof indoBrackets2026 tp in
    let cap = if Money.toCents tp <= 0 then 0 else (Money.toCents tp * gt) // Money.toCents tp in
    { totalTaxDue = max 0 (gt - min (Money.toCents foreignTaxPaidInIdr) cap)
    , proof = { nppnRate = 0.5, grossIdr = Money.toCents grossIdr, taxableProfitIdr = Money.toCents tp, bracketBreakdown = bb, pph24Logic = "Capped at PPh 24 Ceiling: min(Foreign Tax Paid, (" ++ String.fromInt (Money.toCents tp) ++ " / " ++ String.fromInt (Money.toCents tp) ++ ") * " ++ String.fromInt gt ++ ")" }
    }





