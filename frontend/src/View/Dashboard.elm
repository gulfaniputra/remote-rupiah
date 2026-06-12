module View.Dashboard exposing (totalFxLeakage, totalUnrealized, view)

import Data.Compliance as C
import Data.FxEfficiency exposing (FxEfficiencyData)
import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Data.Unrealized exposing (Unrealized)
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onInput)
import Money as M
import TaxLogic as T


isValidNpwp : String -> Bool
isValidNpwp =
    String.filter Char.isDigit >> String.length >> (\len -> len == 15 || len == 16)


isValidNik : String -> Bool
isValidNik =
    String.filter Char.isDigit >> String.length >> (==) 16


view :
    State
    -> Int
    -> String
    -> String
    -> { npwp : String, nik : String, address : String, kluCode : String }
    -> Maybe C.ComplianceStatusResponse
    ->
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
    ->
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
    -> Html msg
renderReady txs unrealized fxLeakage kmkVal source uploadStatus profile complianceStatus handlers =
    let
        annIdr =
            txs |> List.map .amountCents |> List.foldl M.add M.zero |> (\m -> M.multiply m kmkVal)

        unrealizedIdr =
            totalUnrealized unrealized

        fxLeakageIdr =
            totalFxLeakage fxLeakage

        profit =
            T.calculateNppn annIdr

        indo =
            T.calculateIndoTax T.defaultBrackets profit

        whtIdr =
            txs |> List.map .withholdingCents |> List.foldl M.add M.zero |> (\m -> M.multiply m kmkVal)

        credit =
            T.calculatePPh24Credit
                { foreignNetIncome = profit
                , totalTaxableIncome = profit
                , totalIndoTaxDue = indo
                , actualForeignTaxPaid = whtIdr
                }

        fmt m =
            "Rp " ++ M.toString m
    in
    div []
        [ viewNppnAlert { onNppnNotify = handlers.onNppnNotify } complianceStatus
        , div [ class "cards-grid" ]
            [ div [ class "card card-default" ]
                [ h3 [] [ text "WALLET SOURCE" ]
                , select
                    [ class "select"
                    , value source
                    , onInput handlers.onSourceChange
                    ]
                    [ option [ value "wise" ] [ text "wise" ]
                    , option [ value "bank" ] [ text "bank" ]
                    ]
                , button [ class "btn btn-outline mt-3", onClick handlers.onUpload ] [ text "Upload CSV" ]
                , if String.isEmpty uploadStatus then
                    text ""

                  else
                    div [ class "text-secondary mt-2 font-mono" ] [ text uploadStatus ]
                ]
            , div [ class "card card-default" ]
                [ h3 [] [ text "TAX PROFILE (DJP)" ]
                , div [ class "flex flex-col gap-2" ]
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
                        [ button [ class "btn btn-primary flex-1", onClick handlers.onSaveProfile ] [ text "Save" ]
                        , button [ class "btn btn-secondary flex-1", onClick handlers.onExport ] [ text "Export" ]
                        ]
                    ]
                ]
            ]
        , div [ class "cards-grid" ]
            [ summaryCard "YTD GROSS" annIdr "card-teal"
            , summaryCard "FX LEAKAGE" fxLeakageIdr "card-default"
            , summaryCard "PROJECTED TAX" (T.projectYearEndLiability T.defaultBrackets profit 5) "card-default"
            , div [ class "card card-default" ]
                [ h3 [] [ text "UNREALIZED FX GAIN/LOSS" ]
                , div [ class "big-value font-mono text-secondary" ] [ text ("Rp " ++ M.toString unrealizedIdr) ]
                ]
            ]
        , div [ class "middle-grid" ]
            [ div [ class "chart-card" ]
                [ h2 [] [ text "Tax Logic" ]
                , div [ class "calc-row" ] [ text "Net Income", b [] [ text (fmt profit) ] ]
                , div [ class "calc-row" ] [ text "PPh 24 Credit", b [] [ text (fmt credit) ] ]
                , div [ class "final-payable" ] [ text "Final Payable", b [] [ text (fmt (M.subtract indo credit)) ] ]
                ]
            , div [ class "logic-engine" ]
                [ h2 [] [ text "Verification" ]
                , div [ class "transaction-list" ]
                    [ table [ class "table w-full" ]
                        [ thead [] [ tr [] [ th [] [ text "Date" ], th [] [ text "Status" ] ] ]
                        , tbody []
                            (List.map
                                (\tx ->
                                    tr
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
                                                span [ class "text-green flex items-center gap-1 font-mono" ] [ text "🛡️ Verified" ]

                                              else
                                                button [ class "btn btn-outline text-secondary font-mono flex items-center gap-1", onClick (handlers.onVerify tx.id) ] [ text "🛡️ Verify" ]
                                            ]
                                        ]
                                )
                                txs
                            )
                        ]
                    ]
                ]
            ]
        , evidenceLockerPanel complianceStatus
        ]


summaryCard : String -> M.Money c -> String -> Html msg
summaryCard label value cls =
    div [ class ("card " ++ cls) ]
        [ h3 [] [ text label ]
        , div [ class "big-value font-mono" ] [ text ("Rp " ++ M.toString value) ]
        ]


totalUnrealized : List Unrealized -> M.Money M.IDR
totalUnrealized =
    List.foldl
        (\position acc ->
            M.add acc position.unrealizedIdrCents
        )
        M.zero


totalFxLeakage : List FxEfficiencyData -> M.Money M.IDR
totalFxLeakage =
    List.foldl
        (\position acc ->
            M.add acc position.spreadCents
        )
        M.zero


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
                    [ span [ class "font-mono" ] [ text "✅ NPPN filed" ] ]

            else if nppnStatus.isOverdue then
                div [ class "alert alert-danger" ]
                    [ span [ class "font-mono" ] [ text "⚠️ NPPN notification deadline missed — file immediately" ]
                    , button [ class "btn btn-outline ml-3", onClick handlers.onNppnNotify ] [ text "Notify NPPN" ]
                    ]

            else if nppnStatus.daysRemaining <= 14 then
                div [ class "alert alert-warning" ]
                    [ span [ class "font-mono" ] [ text ("⏰ NPPN notification due in " ++ String.fromInt nppnStatus.daysRemaining ++ " days") ]
                    , button [ class "btn btn-outline ml-3", onClick handlers.onNppnNotify ] [ text "Notify NPPN" ]
                    ]

            else
                div [ class "alert alert-info" ]
                    [ span [ class "font-mono" ] [ text ("📋 NPPN notification due in " ++ String.fromInt nppnStatus.daysRemaining ++ " days") ]
                    , button [ class "btn btn-outline ml-3", onClick handlers.onNppnNotify ] [ text "Notify NPPN" ]
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
                    div [ class "flex flex-col gap-2" ]
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
                                table [ class "table w-full mt-1" ]
                                    [ thead [] [ tr [] [ th [] [ text "Type" ], th [] [ text "Year" ], th [] [ text "Verified" ] ] ]
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
