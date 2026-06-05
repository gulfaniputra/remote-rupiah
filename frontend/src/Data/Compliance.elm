module Data.Compliance exposing
    ( ComplianceStatus(..)
    , ComplianceStatusResponse
    , DocumentRecord
    , Urgency(..)
    , W8BenStatus(..)
    , calculateStatus
    , complianceStatusDecoder
    , documentRecordDecoder
    , w8BenStatusDecoder
    )

import Json.Decode as JD
import Time


-- ---------------------------------------------------------------------------
-- Domain types (existing)
-- ---------------------------------------------------------------------------


type ComplianceStatus
    = StandardRate
    | NppnFiled { receiptId : String, filedAt : Time.Posix }
    | ActionRequired { urgency : Urgency, daysRemaining : Int }


type Urgency
    = Normal
    | Urgent
    | Overdue


type alias Config =
    { deadlineYear : Int, deadlineMonth : Time.Month }


calculateStatus : Config -> Time.Posix -> Time.Zone -> ComplianceStatus
calculateStatus config t z =
    if Time.toYear z t == config.deadlineYear && Time.toMonth z t == config.deadlineMonth then
        ActionRequired { urgency = Urgent, daysRemaining = 31 - Time.toDay z t }

    else
        StandardRate


-- ---------------------------------------------------------------------------
-- W-8BEN / Evidence Locker types
-- ---------------------------------------------------------------------------


type W8BenStatus
    = W8BenValid
    | W8BenExpired
    | W8BenMissing


type alias DocumentRecord =
    { documentType : String
    , taxYear : Int
    , isVerified : Bool
    }


type alias ComplianceStatusResponse =
    { w8benStatus : W8BenStatus
    , w8benExpiryDate : Maybe String
    , documents : List DocumentRecord
    }


-- ---------------------------------------------------------------------------
-- Decoders
-- ---------------------------------------------------------------------------


w8BenStatusDecoder : JD.Decoder W8BenStatus
w8BenStatusDecoder =
    JD.string
        |> JD.andThen
            (\s ->
                case s of
                    "Valid" ->
                        JD.succeed W8BenValid

                    "Expired" ->
                        JD.succeed W8BenExpired

                    "Missing" ->
                        JD.succeed W8BenMissing

                    _ ->
                        JD.fail ("Unknown W8BenStatus: " ++ s)
            )


documentRecordDecoder : JD.Decoder DocumentRecord
documentRecordDecoder =
    JD.map3 DocumentRecord
        (JD.field "documentType" JD.string)
        (JD.field "taxYear" JD.int)
        (JD.field "isVerified" JD.bool)


complianceStatusDecoder : JD.Decoder ComplianceStatusResponse
complianceStatusDecoder =
    JD.map3 ComplianceStatusResponse
        (JD.field "w8benStatus" w8BenStatusDecoder)
        (JD.field "w8benExpiryDate" (JD.nullable JD.string))
        (JD.field "documents" (JD.list documentRecordDecoder))
