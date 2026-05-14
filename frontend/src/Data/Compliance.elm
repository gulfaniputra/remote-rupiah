module Data.Compliance exposing (..)
import Time

type ComplianceStatus 
    = StandardRate 
    | NppnFiled { receiptId : String, filedAt : Time.Posix } 
    | ActionRequired { urgency : Urgency, daysRemaining : Int }

type Urgency = Normal | Urgent | Overdue

type alias Config = { deadlineYear : Int, deadlineMonth : Time.Month }

calculateStatus : Config -> Time.Posix -> Time.Zone -> ComplianceStatus
calculateStatus config t z = 
    if Time.toYear z t == config.deadlineYear && Time.toMonth z t == config.deadlineMonth then 
        ActionRequired { urgency = Urgent, daysRemaining = 31 - Time.toDay z t } 
    else 
        StandardRate
