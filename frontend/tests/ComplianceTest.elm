module ComplianceTest exposing (..)
import Data.Compliance as C
import Expect
import Test exposing (..)
import Time
suite = describe "Compliance" [ test "March 31 triggers Urgent" <| \_ -> C.calculateStatus (Time.millisToPosix 1774915200000) Time.utc |> Expect.equal (C.ActionRequired { urgency = C.Urgent, daysRemaining = 0 }) ]
