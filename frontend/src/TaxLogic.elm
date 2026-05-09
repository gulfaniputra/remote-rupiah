module TaxLogic exposing (..)
import Money exposing (IDR, Money)

type alias TaxBracket = { threshold : Money IDR, rate : Int }
type alias PPh24Params = { foreignNetIncome : Money IDR, totalTaxableIncome : Money IDR, totalIndoTaxDue : Money IDR, actualForeignTaxPaid : Money IDR }

calculateNppn m = Money.divide (Money.multiply m 50) 100
calculatePPh24Credit p = let cap = Money.proportion p.totalIndoTaxDue p.foreignNetIncome p.totalTaxableIncome in if Money.compare p.actualForeignTaxPaid cap == LT then p.actualForeignTaxPaid else cap
calculateIndoTax income = List.foldl (\b (p, t) -> (b.threshold, Money.add t (if Money.compare income p == GT then Money.divide (Money.multiply (Money.subtract (if Money.compare income b.threshold == GT then b.threshold else income) p) b.rate) 100 else Money.zero))) (Money.zero, Money.zero) [{threshold=Money.fromCentsStr "6000000000",rate=5},{threshold=Money.fromCentsStr "25000000000",rate=15},{threshold=Money.fromCentsStr "50000000000",rate=25},{threshold=Money.fromCentsStr "500000000000",rate=30},{threshold=Money.fromCentsStr "999999999999999",rate=35}] |> Tuple.second
aggregateAnnualSummary txs = let g = List.foldl (\tx a -> Money.add tx.gross a) Money.zero txs in let n = calculateNppn g in let t = calculateIndoTax n in let f = List.foldl (\tx a -> Money.add tx.foreignTaxPaid a) Money.zero txs in let c = calculatePPh24Credit { foreignNetIncome = n, totalTaxableIncome = n, totalIndoTaxDue = t, actualForeignTaxPaid = f } in { totalGross = g, totalNetIncome = n, totalPPh24Credit = c, totalIndoTaxDue = t, finalTaxPayable = Money.subtract t c |> (\m -> if Money.compare m Money.zero == LT then Money.zero else m) }

projectYearEndLiability ytd month = if month <= 0 then Money.zero else calculateIndoTax (Money.divideRoundUp (Money.multiply ytd 12) month)

-- Legacy/Helper API Compatibility
calculateNPPN = calculateNppn
calculateUsWithholding m = Money.divide m 10
calculateIdrValue m r = Money.divide (Money.multiply m r) 100
calculateNppnProfit m r = calculateNppn (calculateIdrValue m r)
calculateFXLeakage m r act = Money.subtract (calculateIdrValue m r) act
calculateFinalPayable t c = Money.subtract t c |> (\m -> if Money.compare m Money.zero == LT then Money.zero else m)
generateTaxReport g f = let s = aggregateAnnualSummary [{gross=g, foreignTaxPaid=f}] in { totalTaxDue = Money.toCents s.finalTaxPayable, proof = { nppnRate = 0.5, grossIdr = Money.toCents s.totalGross, taxableProfitIdr = Money.toCents s.totalNetIncome, bracketBreakdown = [], pph24Logic = "min" } }
