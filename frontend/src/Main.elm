module Main exposing (main)
import Browser
import Html exposing (..)
import Html.Attributes exposing (..)
import Money exposing (Money)
import Svg exposing (circle, defs, g, linearGradient, path, stop, svg)
import Svg.Attributes as SA
import TaxLogic

main = Browser.sandbox { init = {}, update = \_ m -> m, view = view }

view _ =
    let (annUsd, kmk, mid, cost, bal, act) = (Money.fromCents 5420000, 1612000, 1615000, 1595240, Money.fromCents 1240000, Money.fromCents 85475000000)
        annIdr = TaxLogic.calculateIdrValue annUsd kmk
        profit = TaxLogic.calculateNPPN annIdr
        indoTax = TaxLogic.calculateIndoTax profit
        usTax = TaxLogic.calculateUsWithholding annIdr
        credit = TaxLogic.calculatePPh24Credit { foreignNetIncome = profit, totalTaxableIncome = profit, totalIndoTaxDue = indoTax, actualForeignTaxPaid = usTax }
        payable = TaxLogic.calculateFinalPayable indoTax credit
        leak = TaxLogic.calculateFXLeakage annUsd mid act
        gain = TaxLogic.calculateUnrealizedGain bal mid cost
        
        fmtUSD m = "$" ++ fmtInt (Money.toCents m // 100) ++ ".00"
        fmtIDR m = "Rp " ++ fmtInt (Money.toCents m // 100)
        fmtInt n = (if n < 0 then "-" else "") ++ fmtAbs (abs n)
        fmtAbs v = let s = String.fromInt v in if v < 1000 then s else fmtAbs (v // 1000) ++ "." ++ String.padLeft 3 '0' (String.fromInt (modBy 1000 v))
        
        icon n = case n of
            "brand" -> svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24" ] [ path [ SA.d "M2 12L12 2L22 12L12 22L2 12Z", SA.fill "#2dd4bf" ] [], path [ SA.d "M12 2v20l10-10L12 2z", SA.fill "#115e59" ] [] ]
            "user" -> svg [ SA.width "18", SA.height "18", SA.viewBox "0 0 24 24", SA.stroke "currentColor", SA.strokeWidth "2", SA.fill "none" ] [ path [ SA.d "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" ] [], circle [ SA.cx "12", SA.cy "7", SA.r "4" ] [] ]
            "alert" -> svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.stroke "currentColor", SA.strokeWidth "2", SA.fill "none" ] [ path [ SA.d "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" ] [], path [ SA.d "M12 9v4" ] [], path [ SA.d "M12 17h.01" ] [] ]
            "check" -> svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.stroke "var(--accent-green)", SA.strokeWidth "2", SA.fill "none" ] [ circle [ SA.cx "12", SA.cy "12", SA.r "10" ] [], path [ SA.d "M8 12l3 3 5-5" ] [] ]
            _ -> text ""
    in
    div []
        [ div [ class "topbar" ]
            [ div [ class "flex items-center gap-4" ] [ icon "brand", div [ class "font-bold", style "letter-spacing" "0.05em" ] [ text "REMOTE-RUPIAH" ] ]
            , div [ class "nav-links" ] (List.map (\l -> a [ class "nav-link", href "#" ] [ text l ]) ["Dashboard", "Transactions", "Taxes", "Compliance", "Settings"])
            , div [ class "profile-section" ] [ div [ class "avatar" ] [ icon "user" ], div [ class "flex-col" ] [ div [ class "text-sm font-semibold" ] [ text "Developer" ], div [ class "text-xs text-secondary" ] [ text "NPWP: 12.345.678.9" ] ] ]
            ]
        , div [ class "container" ]
            [ div [ class "dashboard-header" ] [ h1 [] [ text "Dashboard" ], div [ class "kmk-rate" ] [ div [ class "date" ] [ text "KMK Week Rate" ], div [ class "rate" ] [ text ("1 USD = " ++ fmtInt (kmk // 100) ++ " IDR") ] ] ]
            , div [ class "cards-grid" ]
                [ div [ class "card card-teal" ] [ h3 [] [ text "ANNUAL GROSS" ], div [ class "big-value" ] [ text (fmtUSD annUsd) ], div [ class "sub-value" ] [ text (fmtIDR annIdr) ] ]
                , div [ class "card card-default" ] [ h3 [] [ text "TAX LIABILITY" ], div [ class "big-value" ] [ text (fmtIDR indoTax) ], div [ class "sub-value" ] [ text "NPPN 50%" ] ]
                , div [ class "card card-red" ] [ h3 [] [ text "FX LOSS" ], div [ class "big-value" ] [ text (fmtIDR leak) ], div [ class "sub-value" ] [ text "Spread: 2.1%" ], div [ class "alert-icon" ] [ icon "alert" ] ]
                , div [ class "card card-default" ] [ h3 [] [ text "COMPLIANCE" ], div [ class "flex items-center gap-2" ] [ icon "check", div [ class "text-green font-semibold" ] [ text "Active" ] ] ]
                ]
            , div [ class "middle-grid" ]
                [ div [ class "chart-card" ] 
                    [ h2 [] [ text "FX PERFORMANCE" ]
                    , div [ class "chart-container" ] [ svg [ SA.width "100%", SA.height "200", SA.viewBox "0 0 800 200" ] [ path [ SA.d "M0 120 Q50 90, 100 130 T200 110 T400 80 T800 70", SA.fill "none", SA.stroke "#38bdf8", SA.strokeWidth "2" ] [], path [ SA.d "M0 140 Q50 110, 100 150 T200 130 T400 110 T800 90", SA.fill "none", SA.stroke "#2dd4bf", SA.strokeWidth "2" ] [] ] ]
                    , div [ class "chart-footer" ] [ div [] [ h3 [] [ text "Wise: 0.4%" ], h3 [] [ text "PayPal: 4.2%" ] ], div [] [ h3 [] [ text ("Balance: " ++ fmtUSD bal) ], div [ class "text-green" ] [ text ("Gain: " ++ fmtIDR gain) ] ] ]
                    ]
                , div [ class "logic-engine" ]
                    [ h2 [] [ text "TAX LOGIC" ]
                    , List.map (\(l, v) -> div [ class "calc-row" ] [ div [ class "text-secondary" ] [ text l ], div [ class "font-semibold" ] [ text v ] ]) 
                        [ ("Profit (50%)", fmtIDR profit), ("Indo Tax", fmtIDR indoTax), ("US Tax (10%)", fmtIDR usTax), ("PPh 24 Credit", fmtIDR credit) ]
                        |> div []
                    , div [ class "final-payable" ] [ div [] [ text "DJP Payable" ], div [] [ text (fmtIDR payable) ] ]
                    ]
                ]
            , div [ class "table-card" ]
                [ div [ class "table-header-row" ] [ h2 [] [ text "LEDGER" ], button [ class "btn btn-primary" ] [ text "Import CSV" ] ]
                , table [] [ thead [] [ tr [] (List.map (\h -> th [] [ text h ]) ["Date", "Client", "USD", "Rate", "IDR"]) ]
                , tbody [] (List.map (\(d, c, u, r, i) -> tr [] [ td [] [ text d ], td [] [ text c ], td [] [ text u ], td [] [ text r ], td [] [ text i ] ]) 
                    [ ("27/04", "Acme", "$24k", "16k", "Rp 390M"), ("15/03", "Globex", "$15k", "15k", "Rp 238M") ]) ]
                ]
            ]
        ]

