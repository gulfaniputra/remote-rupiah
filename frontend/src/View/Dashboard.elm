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


view : State -> Int -> String -> (String -> msg) -> (String -> msg) -> Html msg
view state kmkVal source onSourceChange onVerify =
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

        Ready { txs, unrealized, fxLeakage } ->
            renderReady txs unrealized fxLeakage kmkVal source onSourceChange onVerify


renderReady : List Transaction -> List Unrealized -> List FxEfficiencyData -> Int -> String -> (String -> msg) -> (String -> msg) -> Html msg
renderReady txs unrealized fxLeakage kmkVal source onSourceChange onVerify =
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
                    , onInput onSourceChange
                    ]
                    [ option [ value "wise" ] [ text "wise" ]
                    , option [ value "bank" ] [ text "bank" ]
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
                                                button [ class "btn btn-outline text-secondary font-mono flex items-center gap-1", onClick (onVerify tx.id) ] [ text "🛡️ Verify" ]
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
