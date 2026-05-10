module Main exposing (main, isDeadlineUrgent)
import Browser
import Money
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)
import Svg exposing (path, svg)
import Svg.Attributes as SA
import TaxLogic
import Time

isDeadlineUrgent t z = Time.toMonth z t == Time.Mar
type Urgency = Normal | Urgent
type ComplianceStatus = StandardRate | NppnFiled { receiptId : String } | ActionRequired { deadline : Time.Posix, urgency : Urgency }

main = Browser.sandbox 
    { init = { status = ActionRequired { deadline = Time.millisToPosix 1774915200000, urgency = Urgent }, txs = [ { id = "1", date = "2026-05-01", isVerified = True }, { id = "2", date = "2026-05-05", isVerified = False } ] }
    , update = \_ m -> m
    , view = \m -> 
        let (annUsd, kmkRate) = (Money.fromCents 5420000, 16120)
            annIdr = Money.multiply annUsd kmkRate
            profit = TaxLogic.calculateNppn annIdr
            indoTax = TaxLogic.calculateIndoTax profit
            credit = TaxLogic.calculatePPh24Credit { foreignNetIncome = profit, totalTaxableIncome = profit, totalIndoTaxDue = indoTax, actualForeignTaxPaid = Money.divide (Money.multiply annIdr 10) 100 }
            fmtIDR m_ = "Rp " ++ Money.toString m_
            icon d = svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ] [ path [ SA.d d ] [] ]
        in div [] 
            [ case m.status of
                ActionRequired { urgency } -> if urgency == Urgent then div [ class "banner banner-urgent" ] [ text "🚨 ACTION REQUIRED: NPPN Notification Deadline is March 31st!" ] else text ""
                _ -> text ""
            , div [ class "topbar" ] [ div [ class "flex items-center gap-4" ] [ icon "M2 12L12 2L22 12L12 22L2 12Z", b [] [ text "REMOTE-RUPIAH" ] ] ]
            , div [ class "container" ] 
                [ div [ class "dashboard-header" ] [ h1 [] [ text "Dashboard" ], div [ class "kmk-rate" ] [ div [ class "rate" ] [ text "1 USD = Rp 16,120.00" ] ] ]
                , div [ class "cards-grid" ]
                    [ div [ class "card card-teal" ] [ h3 [] [ text "YTD GROSS" ], div [ class "big-value font-mono" ] [ text (fmtIDR annIdr) ] ]
                    , div [ class "card card-default" ] [ h3 [] [ text "FX LEAKAGE" ], div [ class "big-value font-mono" ] [ text (fmtIDR Money.zero) ] ]
                    , div [ class "card card-default" ] [ h3 [] [ text "PROJECTED TAX" ], div [ class "big-value font-mono" ] [ text (fmtIDR (TaxLogic.projectYearEndLiability annIdr 5)) ] ]
                    ]
                , div [ class "middle-grid" ] 
                    [ div [ class "chart-card" ] 
                        [ h2 [] [ text "Tax Logic" ]
                        , div [ class "calc-row" ] [ text "Net Income", b [] [ text (fmtIDR profit) ] ]
                        , div [ class "calc-row" ] [ text "PPh 24 Credit", b [] [ text (fmtIDR credit) ] ]
                        , div [ class "final-payable" ] [ text "Final Payable", b [] [ text (fmtIDR (Money.subtract indoTax credit)) ] ] 
                        ]
                    , div [ class "logic-engine" ] 
                        [ h2 [] [ text "Verification" ]
                        , div [ class "transaction-list" ]
                            [ table [ class "table w-full" ]
                                [ thead [] [ tr [] [ th [] [ text "Date" ], th [] [ text "Verification" ] ] ]
                                , tbody [] (List.map (\tx -> tr [] [ td [] [ text tx.date ], td [] [ if tx.isVerified then span [ class "text-green flex items-center gap-1 font-mono" ] [ text "🛡️ Verified" ] else button [ class "btn btn-outline text-secondary font-mono flex items-center gap-1" ] [ text "🛡️ Verify" ] ] ]) m.txs)
                                ]
                            ]
                        ]
                    ]
                ]
            ]
    }
