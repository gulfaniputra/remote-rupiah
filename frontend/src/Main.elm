module Main exposing (main)
import Browser
import Money
import Html exposing (..)
import Html.Attributes exposing (..)
import Svg exposing (circle, path, svg)
import Svg.Attributes as SA
import TaxLogic

main = Browser.sandbox { init = {}, update = \_ m -> m, view = \_ -> 
    let (annUsd, kmkRate) = (Money.fromCents 5420000, 16120)
        annIdr = Money.multiply annUsd kmkRate
        profit = TaxLogic.calculateNppn annIdr
        indoTax = TaxLogic.calculateIndoTax profit
        usTax = Money.divide (Money.multiply annIdr 10) 100
        credit = TaxLogic.calculatePPh24Credit { foreignNetIncome = profit, totalTaxableIncome = profit, totalIndoTaxDue = indoTax, actualForeignTaxPaid = usTax }
        payable = Money.subtract indoTax credit
        fmtIDR m = "Rp " ++ Money.toString m
        icon d = svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ] [ path [ SA.d d ] [] ]
    in div [] [ div [ class "topbar" ] [ div [ class "flex items-center gap-4" ] [ icon "M2 12L12 2L22 12L12 22L2 12Z", b [] [ text "REMOTE-RUPIAH" ] ] ], div [ class "container" ] [ div [ class "dashboard-header" ] [ h1 [] [ text "Dashboard" ], div [ class "kmk-rate" ] [ div [ class "rate" ] [ text "1 USD = Rp 16,120.00" ] ] ], div [ class "cards-grid" ] [ div [ class "card card-teal" ] [ h3 [] [ text "GROSS" ], div [ class "big-value" ] [ text ("$" ++ Money.toString annUsd) ], div [ class "sub-value" ] [ text (fmtIDR annIdr) ] ], div [ class "card card-default" ] [ h3 [] [ text "TAX" ], div [ class "big-value" ] [ text (fmtIDR indoTax) ], div [ class "sub-value" ] [ text "NPPN 50%" ] ], div [ class "card card-default" ] [ h3 [] [ text "SPT 1770" ], div [ class "text-green font-semibold" ] [ text "Ready" ] ] ], div [ class "middle-grid" ] [ div [ class "chart-card" ] [ h2 [] [ text "Tax Logic" ], div [ class "calc-row" ] [ text "Net Income", b [] [ text (fmtIDR profit) ] ], div [ class "calc-row" ] [ text "PPh 24 Credit", b [] [ text (fmtIDR credit) ] ], div [ class "final-payable" ] [ text "Final Payable", b [] [ text (fmtIDR payable) ] ] ], div [ class "logic-engine" ] [ h2 [] [ text "Export" ], button [ class "btn btn-primary", style "width" "100%", style "padding" "1rem" ] [ text "Download SPT CSV" ] ] ] ] ] }
