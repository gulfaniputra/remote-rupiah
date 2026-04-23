module Main exposing (main)

import Browser
import Html exposing (..)
import Html.Attributes exposing (..)
import Money exposing (Money)
import Svg exposing (circle, defs, g, linearGradient, path, stop, svg)
import Svg.Attributes as SA
import TaxLogic

type alias Model = {}
type Msg = NoOp

main : Program () Model Msg
main =
    Browser.sandbox
        { init = {}
        , update = \_ model -> model
        , view = view
        }

view : Model -> Html Msg
view _ =
    let
        -- Setup Constants for Dashboard
        annualGrossUSD =
            Money.fromCents 5420000

        kmkRate =
            1612000 -- 16,120.00

        midMarketRate =
            1615000 -- 16,150.00

        costBasisRate =
            1595240 -- 15,952.40 (inferred)

        usdBalance =
            Money.fromCents 1240000

        actualIdrReceived =
            Money.fromCents 85475000000 -- Placeholder for realized IDR

        -- Calculations
        annualGrossIDR =
            TaxLogic.calculateIdrValue annualGrossUSD kmkRate

        taxableProfit =
            TaxLogic.calculateNPPN annualGrossIDR

        indoTaxDue =
            TaxLogic.calculateIndoTax taxableProfit

        usWithholding =
            TaxLogic.calculateUsWithholding annualGrossIDR

        pph24Credit =
            TaxLogic.calculatePPh24Credit
                { foreignNetIncome = taxableProfit
                , totalTaxableIncome = taxableProfit
                , totalIndoTaxDue = indoTaxDue
                , actualForeignTaxPaid = usWithholding
                }

        finalPayable =
            TaxLogic.calculateFinalPayable indoTaxDue pph24Credit

        fxLeakage =
            TaxLogic.calculateFXLeakage annualGrossUSD midMarketRate actualIdrReceived

        unrealizedGain =
            TaxLogic.calculateUnrealizedGain usdBalance midMarketRate costBasisRate
    in
    div []
        [ topbar
        , div [ class "container" ]
            [ dashboardHeader kmkRate
            , cardsGrid annualGrossUSD annualGrossIDR indoTaxDue fxLeakage
            , middleSection usdBalance midMarketRate unrealizedGain taxableProfit indoTaxDue usWithholding pph24Credit finalPayable
            , tableSection
            ]
        ]


-- TOPBAR
topbar : Html Msg
topbar =
    div [ class "topbar" ]
        [ div [ class "flex items-center gap-4" ]
            [ svgIcon "brand"
            , div [ class "font-bold", style "letter-spacing" "0.05em" ] [ text "REMOTE-RUPIAH (APRIL 2026)" ]
            ]
        , div [ class "nav-links" ]
            [ a [ class "nav-link active", href "#" ] [ text "Dashboard" ]
            , a [ class "nav-link", href "#" ] [ text "Transactions" ]
            , a [ class "nav-link", href "#" ] [ text "Taxes" ]
            , a [ class "nav-link", href "#" ] [ text "Compliance Locker" ]
            , a [ class "nav-link", href "#" ] [ text "Settings" ]
            ]
        , div [ class "profile-section" ]
            [ div [ class "avatar" ]
                [ svgIcon "user" ]
            , div [ class "flex-col" ]
                [ div [ class "text-sm font-semibold" ] [ text "Developer" ]
                , div [ class "text-xs text-secondary" ] [ text "NPWP: 12.345.678.9-012.000" ]
                ]
            ]
        ]

-- HEADER
dashboardHeader : Int -> Html Msg
dashboardHeader rate =
    div [ class "dashboard-header" ]
        [ h1 [] [ text "Dashboard" ]
        , div [ class "kmk-rate" ]
            [ div [ class "date" ] [ text "Current KMK Week Rate (17 Apr - 23 Apr)" ]
            , div [ class "rate" ] [ text ("1 USD = " ++ formatWithCommas (rate // 100) ++ ".00 IDR") ]
            ]
        ]

-- CARDS GRID
cardsGrid : Money -> Money -> Money -> Money -> Html Msg
cardsGrid grossUsd grossIdr estTax leakage =
    div [ class "cards-grid" ]
        [ div [ class "card card-teal" ]
            [ h3 [] [ text "TOTAL ANNUAL GROSS (YTD)" ]
            , div [ class "big-value" ] [ text (formatUSD grossUsd) ]
            , div [ class "sub-value" ] [ text (formatIDR grossIdr) ]
            ]
        , div [ class "card card-default" ]
            [ h3 [] [ text "EST. TAX LIABILITY (PPh 21)" ]
            , div [ class "big-value" ] [ text (formatIDR estTax) ]
            , div [ class "sub-value" ] [ text "NPPN Applied (KLU 62010)" ]
            ]
        , div [ class "card card-red" ]
            [ h3 [] [ text "FX LEAKAGE (LOSS)" ]
            , div [ class "big-value" ] [ text (formatIDR leakage) ]
            , div [ class "sub-value" ] [ text "Average Spread: 2.1%" ]
            , div [ class "alert-icon" ] [ svgIcon "alert" ]
            ]
        , div [ class "card card-default" ]
            [ h3 [] [ text "COMPLIANCE STATUS" ]
            , div [ class "flex items-center gap-2", style "margin-bottom" "0.5rem" ]
                [ svgIcon "success-circle"
                , div [ class "font-semibold text-green" ] [ text "NPPN Active" ]
                ]
            , div [ class "text-secondary font-semibold text-sm", style "margin-left" "1.75rem" ] [ text "1042-S Missing: ", span [ class "text-red" ] [ text "2" ] ]
            ]
        ]

-- MIDDLE SECTION
middleSection : Money -> Int -> Money -> Money -> Money -> Money -> Money -> Money -> Html Msg
middleSection balance rate unrealized profit totalTax usTax credit payable =
    div [ class "middle-grid" ]
        [ fxTrackerCard balance rate unrealized
        , taxLogicEngine profit totalTax usTax credit payable
        ]

fxTrackerCard : Money -> Int -> Money -> Html Msg
fxTrackerCard balance rate unrealized =
    div [ class "chart-card" ]
        [ h2 [] [ text "FX PERFORMANCE TRACKER" ]
        , div [ class "flex justify-center items-center gap-6 text-xs text-secondary font-semibold" ]
            [ div [ class "flex items-center gap-2" ]
                [ span [ style "width" "16px", style "height" "2px", style "background" "#38bdf8", style "display" "inline-block" ] []
                , text "Mid-Market Rate"
                ]
            , div [ class "flex items-center gap-2" ]
                [ span [ style "width" "16px", style "height" "2px", style "background" "#2dd4bf", style "display" "inline-block" ] []
                , text "Realized IDR Rate (BCA)"
                ]
            ]
        , div [ class "chart-container" ]
            [ svgChartPlaceholder ]
        , div [ class "flex justify-between text-xs text-secondary mt-2" ]
            [ text "6 months"
            , text "February"
            , text "March"
            , text "April"
            , text "6 months"
            ]
        , div [ class "chart-footer" ]
            [ div []
                [ h3 [] [ text "FX PERFORMANCE TRACKER" ]
                , ul [ class "text-sm text-secondary", style "list-style-type" "disc", style "padding-left" "1rem" ]
                    [ li [] [ text "Primary Provider: Wise (0.4% spread)" ]
                    , li [] [ text "Switch Recommended: PayPal (4.2% spread)" ]
                    ]
                ]
            , div []
                [ h3 [] [ text "UNREALIZED GAIN/LOSS" ]
                , div [ class "text-sm text-secondary", style "line-height" "1.6" ]
                    [ div [] [ text ("Current USD Balance: " ++ formatUSD balance) ]
                    , div [] [ text "Unrealized Gain: ", span [ class "text-green" ] [ text (formatIDR unrealized) ], text (" (Market Rate: " ++ String.fromFloat (toFloat rate / 100.0) ++ ")") ]
                    ]
                ]
            ]
        ]

svgChartPlaceholder : Html Msg
svgChartPlaceholder =
    svg
        [ SA.width "100%"
        , SA.height "200"
        , SA.viewBox "0 0 800 200"
        , SA.preserveAspectRatio "none"
        , style "display" "block"
        ]
        [ g []
            [ path
                [ SA.d "M0 120 Q50 90, 100 130 T200 110 T300 130 T400 80 T500 120 T600 90 T700 110 T800 70"
                , SA.fill "none"
                , SA.stroke "#38bdf8"
                , SA.strokeWidth "2"
                , SA.strokeLinecap "round"
                ] []
            , path
                [ SA.d "M0 140 Q50 110, 100 150 T200 130 T300 150 T400 110 T500 140 T600 110 T700 130 T800 90"
                , SA.fill "none"
                , SA.stroke "#2dd4bf"
                , SA.strokeWidth "2"
                , SA.strokeLinecap "round"
                ] []
            -- Subtle neon glow effects
            , path
                [ SA.d "M0 140 Q50 110, 100 150 T200 130 T300 150 T400 110 T500 140 T600 110 T700 130 T800 90 L800 200 L0 200 Z"
                , SA.fill "url(#chartGrad)"
                , SA.opacity "0.2"
                ] []
            , defs []
                [ linearGradient [ SA.id "chartGrad", SA.x1 "0", SA.y1 "0", SA.x2 "0", SA.y2 "1" ]
                    [ stop [ SA.offset "0%", SA.stopColor "#2dd4bf" ] []
                    , stop [ SA.offset "100%", SA.stopColor "rgba(45,212,191,0)" ] []
                    ]
                ]
            ]
        ]


taxLogicEngine : Money -> Money -> Money -> Money -> Money -> Html Msg
taxLogicEngine profit totalTax usTax credit payable =
    div [ class "logic-engine" ]
        [ h2 [] [ text "TAX LOGIC ENGINE" ]
        , div [ class "calc-row" ]
            [ div [ class "text-secondary" ] [ text "Calculated Profit (Norma 50%):" ]
            , div [ class "font-semibold" ] [ text (formatIDR profit) ]
            ]
        , div [ class "calc-row" ]
            [ div [ class "text-secondary" ] [ text "Indonesian Tax Due (Progressive 2026):" ]
            , div [ class "font-bold" ] [ text (formatIDR totalTax) ]
            ]
        , div [ class "calc-row" ]
            [ div [ class "text-secondary" ] [ text "US Withholding (W-8BEN 10%):" ]
            , div [ class "font-semibold" ] [ text (formatIDR usTax) ]
            ]
        , div [ class "calc-block" ]
            [ div [ class "calc-block-header" ] [ text "ALLOWABLE PPh 24 CREDIT:" ]
            , div [ class "bracket-container" ]
                [ div [ class "bracket-left" ] [ text "Lesser of" ]
                , div [ class "brace" ] [ text "{" ]
                , div [ class "bracket-content" ]
                    [ div [] [ span [ class "font-semibold" ] [ text "min(" ], text ("Actual US Tax: " ++ formatIDR usTax) ]
                    , div [] [ text ("Indo Cap: " ++ formatIDR credit) ]
                    , div [] [ text ("Total Indo Tax: " ++ formatIDR totalTax), span [ class "font-semibold" ] [ text ")" ] ]
                    ]
                , div [ class "bracket-right" ]
                    [ div [ class "val" ] [ text (formatIDR credit) ]
                    , div [ class "lbl" ] [ text "(Capped by Indo liability)" ]
                    ]
                ]
            ]
        , div [ class "final-payable" ]
            [ div [] [ text "Final DJP Payable:" ]
            , div [] [ text (formatIDR payable) ]
            ]
        ]


-- TABLE SECTION
tableSection : Html Msg
tableSection =
    div [ class "table-card" ]
        [ div [ class "table-header-row" ]
            [ h2 [ style "margin-bottom" "0" ] [ text "TRANSACTION LEDGER & COMPLIANCE" ]
            , div [ class "table-actions" ]
                [ button [ class "btn btn-primary" ] [ text "Import CSV" ]
                , div [ class "link-btn" ] [ text "Fuzzy Field Mapper" ]
                ]
            ]
        , table []
            [ thead []
                [ tr []
                    [ th [] [ text "Date" ]
                    , th [] [ text "Client" ]
                    , th [] [ text "Gross (USD)" ]
                    , th [] [ text "KMK Rate" ]
                    , th [] [ text "IDR Value" ]
                    , th [ style "text-align" "center" ] [ text "1042-S" ]
                    , th [ style "text-align" "center" ] [ text "Actions" ]
                    ]
                ]
            , tbody []
                [ tableRow "27/04/2026" "Acme Corp" "$24,200.00" "16,120.00" "Rp 390.104.000" True
                , tableRow "15/03/2026" "Globex Inc." "$15,000.00" "15,900.00" "Rp 238.500.000" True
                , tableRow "02/02/2026" "Globex Inc." "$5,000.00" "15,900.00" "Rp 79.500.000" False
                , tableRow "10/01/2026" "Carger Corp." "$10,000.00" "15,909.60" "Rp 159.096.000" False
                ]
            ]
        ]

tableRow : String -> String -> String -> String -> String -> Bool -> Html Msg
tableRow date client gross kmk idr isSuccess =
    tr []
        [ td [] [ text date ]
        , td [] [ text client ]
        , td [] [ text gross ]
        , td [] [ text kmk ]
        , td [] [ text idr ]
        , td [ style "text-align" "center" ] 
            [ span [ class (if isSuccess then "status-icon icon-success" else "status-icon icon-warning") ] 
                [ svgIcon (if isSuccess then "check-mini" else "alert-mini") ] 
            ]
        , td [ style "text-align" "center" ]
            [ div [ class "action-icons justify-center" ]
                [ svgIcon "eye", svgIcon "edit", svgIcon "upload" ]
            ]
        ]

-- SVG ICONS CACHE
svgIcon : String -> Html Msg
svgIcon name =
    case name of
        "brand" ->
            svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none" ]
                [ path [ SA.d "M2 12L12 2L22 12L12 22L2 12Z", SA.fill "#2dd4bf" ] [], path [ SA.d "M12 2v20l10-10L12 2z", SA.fill "#115e59" ] [] ]
        "user" ->
            svg [ SA.width "18", SA.height "18", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ]
                [ path [ SA.d "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" ] [], circle [ SA.cx "12", SA.cy "7", SA.r "4" ] [] ]
        "alert" ->
            svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2", SA.strokeLinejoin "round" ]
                [ path [ SA.d "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" ] [], path [ SA.d "M12 9v4" ] [], path [ SA.d "M12 17h.01" ] [] ]
        "success-circle" ->
            svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "var(--accent-green)", SA.strokeWidth "2" ]
                [ circle [ SA.cx "12", SA.cy "12", SA.r "10" ] [], path [ SA.d "M8 12l3 3 5-5" ] [] ]
        "check-mini" ->
            svg [ SA.width "12", SA.height "12", SA.viewBox "0 0 24 24", SA.fill "currentcolor" ]
                [ path [ SA.d "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" ] [] ]
        "alert-mini" ->
            svg [ SA.width "12", SA.height "12", SA.viewBox "0 0 24 24", SA.fill "currentcolor" ]
                [ path [ SA.d "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" ] [] ]
        "eye" ->
            svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ]
                [ path [ SA.d "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" ] [], circle [ SA.cx "12", SA.cy "12", SA.r "3" ] [] ]
        "edit" ->
            svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ]
                [ path [ SA.d "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" ] [], path [ SA.d "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" ] [] ]
        "upload" ->
            svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ]
                [ path [ SA.d "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" ] [], path [ SA.d "M17 8l-5-5-5 5" ] [], path [ SA.d "M12 3v12" ] [] ]
        _ ->
            text ""


-- FORMATTERS
formatUSD : Money -> String
formatUSD money =
    let
        cents = Money.toCents money
        dollars = cents // 100
        remCents = modBy 100 cents
    in
    "$" ++ formatWithCommas dollars ++ "." ++ String.padLeft 2 '0' (String.fromInt remCents)


formatIDR : Money -> String
formatIDR money =
    let
        cents = Money.toCents money
        rupiah = cents // 100
    in
    "Rp " ++ formatWithCommas rupiah


formatWithCommas : Int -> String
formatWithCommas n =
    let
        str = String.fromInt (abs n)
        prefix = if n < 0 then "-" else ""
        reversed = String.reverse str
        chunks = splitEvery 3 reversed
    in
    prefix ++ String.reverse (String.join "." chunks)


splitEvery : Int -> String -> List String
splitEvery n s =
    if String.length s <= n then
        [ s ]
    else
        String.left n s :: splitEvery n (String.dropLeft n s)
