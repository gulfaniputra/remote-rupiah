module Data.Forecast exposing (DeadlineStatus(..), Forecast, empty, deadlineLabel, deadlineIsUrgent)

import Money exposing (IDR, Money)

type alias Forecast = { ytdNetIncome : Money IDR, projectedAnnualTax : Money IDR, fxLeakage : Money IDR, deadlineStatus : DeadlineStatus }
type DeadlineStatus = NotRequired | Pending { year : Int, daysRemaining : Int } | Completed String

empty = { ytdNetIncome = Money.zero, projectedAnnualTax = Money.zero, fxLeakage = Money.zero, deadlineStatus = NotRequired }
deadlineLabel s = case s of
    NotRequired -> "Not Required"
    Pending dl -> "Due March 31, " ++ String.fromInt dl.year ++ " (" ++ String.fromInt dl.daysRemaining ++ " days)"
    Completed rid -> "Completed (" ++ rid ++ ")"
deadlineIsUrgent s = case s of
    Pending dl -> dl.daysRemaining < 30
    _ -> False
