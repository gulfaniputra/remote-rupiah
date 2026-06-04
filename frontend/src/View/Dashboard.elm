module View.Dashboard exposing (totalFxLeakage, totalUnrealized, view)

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
    -> { onSourceChange : String -> msg
       , onVerify : String -> msg
       , onUpload : msg
       , onNpwpChange : String -> msg
       , onNikChange : String -> msg
       , onAddressChange : String -> msg
       , onKluCodeChange : String -> msg
       , onSaveProfile : msg
       , onExport : msg
       }
    -> Html msg
view state kmkVal source uploadStatus profile handlers =
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
            renderReady txs unrealized fxLeakage kmkVal source uploadStatus profile handlers


renderReady :
    List Transaction
    -> List Unrealized
    -> List FxEfficiencyData
    -> Int
    -> String
    -> String
    -> { npwp : String, nik : String, address : String, kluCode : String }
    -> { onSourceChange : String -> msg
       , onVerify : String -> msg
       , onUpload : msg
       , onNpwpChange : String -> msg
       , onNikChange : String -> msg
       , onAddressChange : String -> msg
       , onKluCodeChange : String -> msg
       , onSaveProfile : msg
       , onExport : msg
       }
    -> Html msg
renderReady txs unrealized fxLeakage kmkVal source uploadStatus profile handlers =
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
            T.calculateIndoTax profit

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
        [ div [ class "cards-grid" ]
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
            , summaryCard "PROJECTED TAX" (T.projectYearEndLiability profit 5) "card-default"
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
