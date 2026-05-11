module Data.Compliance exposing (..)
import Time
type ComplianceStatus = StandardRate | NppnFiled { receiptId : String, filedAt : Time.Posix } | ActionRequired { urgency : Urgency, daysRemaining : Int }
type Urgency = Normal | Urgent | Overdue
calculateStatus t z = if Time.toYear z t == 2026 && Time.toMonth z t == Time.Mar then ActionRequired { urgency = Urgent, daysRemaining = 31 - Time.toDay z t } else StandardRate
