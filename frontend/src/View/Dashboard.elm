module View.Dashboard exposing (DashboardHandlers, totalFxLeakage, totalUnrealized, view)

import Data.Compliance as C
import Data.FxEfficiency exposing (FxEfficiencyData)
import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Data.Unrealized exposing (Unrealized)
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onInput)
import Html.Keyed
import Money
import TaxLogic as T


type alias DashboardHandlers msg =
    { onSourceChange : String -> msg
    , onVerify : String -> msg
    , onUpload : msg
    , onNpwpChange : String -> msg
    , onNikChange : String -> msg
    , onAddressChange : String -> msg
    , onKluCodeChange : String -> msg
    , onSaveProfile : msg
    , onExport : msg
    , onNppnNotify : msg
    }


isValidNpwp : String -> Bool
isValidNpwp =
    String.filter Char.isDigit >> String.length >> (\len -> len == 15 || len == 16)


isValidNik : String -> Bool
isValidNik =
    String.filter Char.isDigit >> String.length >> (==) 16


formatSourceLabel : String -> String
formatSourceLabel source =
    case source of
        "wise" ->
            "Wise"

        "bank" ->
            "Banks"

        _ ->
            source


view :
    State
    -> Int
    -> String
    -> String
    -> { npwp : String, nik : String, address : String, kluCode : String }
    -> Maybe C.ComplianceStatusResponse
    -> DashboardHandlers msg
    -> Html msg
view state kmkVal source uploadStatus profile complianceStatus handlers =
    case state of
        Loading ->
            div [ class "cards-grid" ]
                [ div [ class "card card-default" ]
                    [ div [ class "loading-spinner" ] [ text "Loading transactions…" ] ]
                ]

        Failure errorMsg ->
            div [ class "cards-grid" ]
                [ div [ class "card card-default" ]
                    [ h3 [] [ text "Error" ]
                    , div [ class "text-danger" ] [ text errorMsg ]
                    ]
                ]

        MappingRequired _ ->
            div [ class "cards-grid" ]
                [ div [ class "card card-default" ]
                    [ h3 [] [ text "CSV mapping required" ]
                    , div [ class "text-secondary" ] [ text "Open the CSV mapper to continue." ]
                    ]
                ]

        Ready { txs, unrealized, fxLeakage } ->
            renderReady txs unrealized fxLeakage kmkVal source uploadStatus profile complianceStatus handlers


renderReady :
    List Transaction
    -> List Unrealized
    -> List FxEfficiencyData
    -> Int
    -> String
    -> String
    -> { npwp : String, nik : String, address : String, kluCode : String }
    -> Maybe C.ComplianceStatusResponse
    -> DashboardHandlers msg
    -> Html msg
renderReady txs unrealized fxLeakage kmkVal source uploadStatus profile complianceStatus handlers =
    let
        annIdr =
            txs
                |> List.foldl
                    (\tx acc ->
                        case tx.actualIdrReceivedCents of
                            Just idr ->
                                Money.add acc idr

                            Nothing ->
                                acc
                    )
                    Money.zero

        unrealizedIdr =
            totalUnrealized unrealized

        fxLeakageIdr =
            totalFxLeakage fxLeakage

        profit =
            T.calculateNppn annIdr

        indo =
            T.calculateIndoTax T.defaultBrackets profit

        whtIdr =
            if List.isEmpty txs then
                Money.zero

            else
                txs
                    |> List.foldl (\tx acc -> Money.add acc tx.withholdingCents) Money.zero
                    |> (\m -> Money.multiply m kmkVal)

        credit =
            T.calculatePPh24Credit
                { foreignNetIncome = profit
                , totalTaxableIncome = profit
                , totalIndoTaxDue = indo
                , actualForeignTaxPaid = whtIdr
                }

        finalTaxOwed =
            Money.subtract indo credit

        isOverpayment =
            Money.toString finalTaxOwed |> String.startsWith "-"

        taxLiabilityLabel =
            if isOverpayment then
                "Tax Overpayment"

            else
                "Final Payable"

        fmt m =
            toShorthand m
    in
    div []
        [ viewNppnAlert { onNppnNotify = handlers.onNppnNotify } complianceStatus
        , div [ class "cards-grid" ]
            [ div [ class "card card-default" ]
                [ h3 [] [ text "WALLET SOURCE" ]
                , div [ class "mt-2" ]
                    [ select
                        [ value source
                        , onInput handlers.onSourceChange
                        ]
                        [ option [ value "wise" ] [ text (formatSourceLabel "wise") ]
                        , option [ value "bank" ] [ text (formatSourceLabel "bank") ]
                        ]
                    ]
                , button [ class "btn btn-primary mt-3", onClick handlers.onUpload ] [ text "Upload CSV" ]
                , if String.isEmpty uploadStatus then
                    text ""

                  else
                    div [ class "text-secondary mt-2 font-mono text-xs" ] [ text uploadStatus ]
                ]
            , div [ class "card card-default" ]
                [ h3 [] [ text "TAX PROFILE (DJP)" ]
                , div [ class "flex-col gap-2" ]
                    [ div []
                        [ label [ class "text-xs text-secondary font-semibold" ] [ text "NPWP" ]
                        , input [ id "tax-npwp", class "input", value profile.npwp, onInput handlers.onNpwpChange ] []
                        , if not (String.isEmpty profile.npwp) && not (isValidNpwp profile.npwp) then
                            div [ class "validation-error" ] [ text "NPWP must be 15 or 16 digits" ]

                          else
                            text ""
                        ]
                    , div []
                        [ label [ class "text-xs text-secondary font-semibold" ] [ text "NIK" ]
                        , input [ id "tax-nik", class "input", value profile.nik, onInput handlers.onNikChange ] []
                        , if not (String.isEmpty profile.nik) && not (isValidNik profile.nik) then
                            div [ class "validation-error" ] [ text "NIK must be 16 digits" ]

                          else
                            text ""
                        ]
                    , div []
                        [ label [ class "text-xs text-secondary font-semibold" ] [ text "Address" ]
                        , input [ id "tax-address", class "input", value profile.address, onInput handlers.onAddressChange ] []
                        ]
                    , div []
                        [ label [ class "text-xs text-secondary font-semibold" ] [ text "KLU Code" ]
                        , input [ id "tax-klu", class "input", value profile.kluCode, onInput handlers.onKluCodeChange ] []
                        ]
                    , div [ class "flex gap-2 mt-2" ]
                        [ button [ class "btn btn-primary", onClick handlers.onSaveProfile ] [ text "Save" ]
                        , button [ class "btn btn-outline", onClick handlers.onExport ] [ text "Export" ]
                        ]
                    ]
                ]
            ]
        , div [ class "cards-grid" ]
            [ summaryCard "YTD GROSS" annIdr "card-teal"
            , summaryCard "FX LEAKAGE" fxLeakageIdr "card-default"
            , summaryCard "PROJECTED TAX" (T.projectYearEndLiability T.defaultBrackets annIdr 12) "card-default"
            , div [ class "card card-default" ]
                [ h3 [] [ text "UNREALIZED FX GAIN/LOSS" ]
                , div [ class "big-value font-mono text-secondary" ] [ text (fmt unrealizedIdr) ]
                ]
            ]
        , div [ class "middle-grid" ]
            [ div [ class "chart-card" ]
                [ h2 [] [ text "Tax Logic" ]
                , div [ class "calc-row" ] [ text "Net Income (NPPN)", b [] [ text (fmt profit) ] ]
                , div [ class "calc-row" ] [ text "PPh 24 Tax Credit", b [] [ text (fmt credit) ] ]
                , div [ class "final-payable" ] [ text taxLiabilityLabel, b [] [ text (fmt finalTaxOwed) ] ]
                ]
            , div [ class "logic-engine" ]
                [ h2 [] [ text "Verification" ]
                , div [ class "table-card mt-2" ]
                    [ table []
                        [ thead []
                            [ tr []
                                [ th [] [ text "Date" ]
                                , th [] [ text "Status" ]
                                ]
                            ]
                        , Html.Keyed.node "tbody"
                            []
                            (List.map
                                (\tx ->
                                    ( tx.id
                                    , tr
                                        [ class
                                            (if tx.is1042sVerified then
                                                "row-locked"

                                             else
                                                ""
                                            )
                                        ]
                                        [ td [] [ text tx.date ]
                                        , td []
                                            [ if tx.is1042sVerified then
                                                span [ class "text-green flex gap-1 font-mono text-sm" ] [ text "🛡️ Verified" ]

                                              else
                                                button [ class "btn btn-primary font-mono text-xs flex gap-1", onClick (handlers.onVerify tx.id) ] [ text "🛡️ Verify" ]
                                            ]
                                        ]
                                    )
                                )
                                txs
                            )
                        ]
                    ]
                ]
            ]
        , evidenceLockerPanel complianceStatus
        ]


summaryCard : String -> Money.Money c -> String -> Html msg
summaryCard label value cls =
    div [ class ("card " ++ cls) ]
        [ h3 [] [ text label ]
        , div [ class "big-value font-mono" ] [ text (toShorthand value) ]
        ]


totalUnrealized : List Unrealized -> Money.Money Money.IDR
totalUnrealized =
    List.foldl (\position acc -> Money.add acc position.unrealizedIdrCents) Money.zero


totalFxLeakage : List FxEfficiencyData -> Money.Money Money.IDR
totalFxLeakage =
    List.foldl (\position acc -> Money.add acc position.spreadCents) Money.zero


w8BenBadge : C.W8BenStatus -> Html msg
w8BenBadge status =
    case status of
        C.W8BenValid ->
            span [ class "text-green font-mono" ] [ text "✅ Valid" ]

        C.W8BenExpired ->
            span [ class "text-danger font-mono" ] [ text "⚠️ Expired" ]

        C.W8BenMissing ->
            span [ class "text-secondary font-mono" ] [ text "— Missing" ]


viewNppnAlert : { onNppnNotify : msg } -> Maybe C.ComplianceStatusResponse -> Html msg
viewNppnAlert handlers maybeStatus =
    case maybeStatus of
        Nothing ->
            text ""

        Just { nppnStatus } ->
            if nppnStatus.notified then
                div [ class "alert alert-success" ]
                    [ span [ class "font-mono" ] [ text "✅ NPPN Notification filed with DJP" ] ]

            else if nppnStatus.isOverdue then
                div [ class "alert alert-danger" ]
                    [ span [ class "font-mono" ] [ text "⚠️ NPPN notification deadline missed — file immediately" ]
                    , button [ class "btn btn-primary", onClick handlers.onNppnNotify ] [ text "Notify NPPN" ]
                    ]

            else if nppnStatus.daysRemaining <= 14 then
                div [ class "alert alert-warning" ]
                    [ span [ class "font-mono" ] [ text ("⏰ NPPN notification due in " ++ String.fromInt nppnStatus.daysRemaining ++ " days") ]
                    , button [ class "btn btn-primary", onClick handlers.onNppnNotify ] [ text "Notify NPPN" ]
                    ]

            else
                div [ class "alert alert-info" ]
                    [ span [ class "font-mono" ] [ text ("📋 NPPN notification due in " ++ String.fromInt nppnStatus.daysRemaining ++ " days") ]
                    , button [ class "btn btn-primary", onClick handlers.onNppnNotify ] [ text "Notify NPPN" ]
                    ]


evidenceLockerPanel : Maybe C.ComplianceStatusResponse -> Html msg
evidenceLockerPanel maybeStatus =
    div [ class "cards-grid" ]
        [ div [ class "card card-default" ]
            [ h3 [] [ text "EVIDENCE LOCKER" ]
            , case maybeStatus of
                Nothing ->
                    div [ class "text-secondary" ] [ text "Loading compliance status…" ]

                Just status ->
                    div [ class "flex-col gap-2" ]
                        [ div []
                            [ label [ class "text-xs text-secondary font-semibold" ] [ text "W-8BEN STATUS" ]
                            , div [ class "mt-1" ] [ w8BenBadge status.w8benStatus ]
                            , case status.w8benExpiryDate of
                                Just d ->
                                    div [ class "text-xs text-secondary font-mono mt-1" ] [ text ("Expiry: " ++ d) ]

                                Nothing ->
                                    text ""
                            ]
                        , div []
                            [ label [ class "text-xs text-secondary font-semibold" ] [ text "1042-S DOCUMENTS" ]
                            , if List.isEmpty status.documents then
                                div [ class "text-secondary text-xs mt-1" ] [ text "No documents uploaded." ]

                              else
                                div [ class "table-card mt-1" ]
                                    [ table []
                                        [ thead []
                                            [ tr []
                                                [ th [] [ text "Type" ]
                                                , th [] [ text "Year" ]
                                                , th [] [ text "Verified" ]
                                                ]
                                            ]
                                        , tbody []
                                            (List.map
                                                (\doc ->
                                                    tr []
                                                        [ td [ class "font-mono" ] [ text doc.documentType ]
                                                        , td [] [ text (String.fromInt doc.taxYear) ]
                                                        , td []
                                                            [ if doc.isVerified then
                                                                span [ class "text-green" ] [ text "✅" ]

                                                              else
                                                                span [ class "text-secondary" ] [ text "—" ]
                                                            ]
                                                        ]
                                                )
                                                status.documents
                                            )
                                        ]
                                    ]
                            ]
                        ]
            ]
        ]


toShorthand : Money.Money c -> String
toShorthand money =
    let
        cents =
            Money.toCents money

        isNegative =
            cents < 0

        absCents =
            if isNegative then
                negate cents

            else
                cents

        billion =
            1000000000 * 100

        million =
            1000000 * 100

        thousand =
            1000 * 100

        ( amount, suffix ) =
            if absCents >= billion then
                ( toFloat absCents / toFloat billion, "B" )

            else if absCents >= million then
                ( toFloat absCents / toFloat million, "M" )

            else if absCents >= thousand then
                ( toFloat absCents / toFloat thousand, "K" )

            else
                ( toFloat absCents / 100.0, "" )

        formatted =
            let
                rounded =
                    round (amount * 10)

                whole =
                    rounded // 10

                frac =
                    modBy 10 rounded
            in
            if frac == 0 then
                String.fromInt whole ++ suffix

            else
                String.fromInt whole ++ "." ++ String.fromInt frac ++ suffix

        sign =
            if isNegative then
                "-"

            else
                ""
    in
    "IDR " ++ sign ++ formatted


formatWithCommas : String -> String
formatWithCommas rawStr =
    case String.split "." rawStr of
        [ integerPart, decimalPart ] ->
            formatIntegerString integerPart ++ "." ++ decimalPart

        _ ->
            formatIntegerString rawStr


formatIntegerString : String -> String
formatIntegerString str =
    if String.startsWith "-" str then
        "-" ++ formatIntegerGroups (String.dropLeft 1 str)

    else
        formatIntegerGroups str


formatIntegerGroups : String -> String
formatIntegerGroups str =
    str
        |> String.reverse
        |> chunkString 3
        |> String.join ","
        |> String.reverse


chunkString : Int -> String -> List String
chunkString size str =
    if String.isEmpty str then
        []

    else
        String.left size str :: chunkString size (String.dropLeft size str)
