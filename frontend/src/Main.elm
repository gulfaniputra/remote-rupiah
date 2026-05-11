module Main exposing (main)
import Browser
import Data.Compliance as C
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)
import Money as M
import Svg exposing (path, svg)
import Svg.Attributes as SA
import TaxLogic as T
import Time
import View.Dashboard as D

type alias Model = { s : C.ComplianceStatus, txs : List { id : String, date : String, isVerified : Bool }, t : Time.Posix }
type Msg = Verify String | Tick Time.Posix

main : Program () Model Msg
main = Browser.element 
    { init = \_ -> ({ s = C.StandardRate, txs = [{ id = "1", date = "2026-05-01", isVerified = True }, { id = "2", date = "2026-05-05", isVerified = False }], t = Time.millisToPosix 0 }, Cmd.none)
    , update = \msg m -> case msg of 
        Verify id -> ({ m | txs = List.map (\tx -> if tx.id == id then { tx | isVerified = True } else tx) m.txs }, Cmd.none)
        Tick t -> ({ m | t = t, s = C.calculateStatus t Time.utc }, Cmd.none)
    , subscriptions = \_ -> Time.every 1000 Tick
    , view = \m ->
        let
            (annUsd, kmk) = (M.fromCents 5420000, 16120)
            annIdr = M.multiply annUsd kmk
            profit = T.calculateNppn annIdr
            indo = T.calculateIndoTax profit
            credit = T.calculatePPh24Credit { foreignNetIncome = profit, totalTaxableIncome = profit, totalIndoTaxDue = indo, actualForeignTaxPaid = M.divide (M.multiply annIdr 10) 100 }
            fmt m_ = "Rp " ++ M.toString m_
            banner = case m.s of
                C.ActionRequired { urgency } -> if urgency == C.Urgent then div [ class "banner banner-urgent sticky top-0 z-50" ] [ text "🚨 ACTION REQUIRED: NPPN Notification Deadline is March 31st!" ] else text ""
                _ -> text ""
        in
        div [] 
            [ banner
            , div [ class "topbar" ] [ div [ class "flex items-center gap-4" ] [ svg [ SA.width "24", SA.height "24", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ] [ path [ SA.d "M2 12L12 2L22 12L12 22L2 12Z" ] [] ], b [] [ text "REMOTE-RUPIAH" ] ] ]
            , div [ class "container" ] 
                [ div [ class "dashboard-header" ] [ h1 [] [ text "Dashboard" ], div [ class "kmk-rate" ] [ div [ class "rate" ] [ text "1 USD = Rp 16,120.00" ] ] ]
                , D.view { ytdGross = annIdr, fxLeakage = M.zero, projectedTax = T.projectYearEndLiability profit 5 }
                , div [ class "middle-grid" ] 
                    [ div [ class "chart-card" ] [ h2 [] [ text "Tax Logic" ], div [ class "calc-row" ] [ text "Net Income", b [] [ text (fmt profit) ] ], div [ class "calc-row" ] [ text "PPh 24 Credit", b [] [ text (fmt credit) ] ], div [ class "final-payable" ] [ text "Final Payable", b [] [ text (fmt (M.subtract indo credit)) ] ] ]
                    , div [ class "logic-engine" ] [ h2 [] [ text "Verification" ], div [ class "transaction-list" ] [ table [ class "table w-full" ] [ thead [] [ tr [] [ th [] [ text "Date" ], th [] [ text "Verification" ] ] ], tbody [] (List.map (\tx -> tr [ class (if tx.isVerified then "row-locked" else "") ] [ td [] [ text tx.date ], td [] [ if tx.isVerified then span [ class "text-green flex items-center gap-1 font-mono" ] [ text "🛡️ Verified" ] else button [ class "btn btn-outline text-secondary font-mono flex items-center gap-1", onClick (Verify tx.id) ] [ text "🛡️ Verify" ] ] ]) m.txs) ] ] ] ]
                ]
            ]
    }
