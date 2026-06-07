module Data.Compliance exposing
    ( ComplianceStatusResponse
    , DocumentRecord
    , NppnStatus
    , W8BenStatus(..)
    , complianceStatusDecoder
    , documentRecordDecoder
    , nppnStatusDecoder
    , w8BenStatusDecoder
    )

import Json.Decode as JD



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


type alias NppnStatus =
    { notified : Bool
    , notifiedAt : Maybe String
    , deadline : String
    , daysRemaining : Int
    , isOverdue : Bool
    }


type alias ComplianceStatusResponse =
    { w8benStatus : W8BenStatus
    , w8benExpiryDate : Maybe String
    , documents : List DocumentRecord
    , nppnStatus : NppnStatus
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


nppnStatusDecoder : JD.Decoder NppnStatus
nppnStatusDecoder =
    JD.map5 NppnStatus
        (JD.field "notified" JD.bool)
        (JD.field "notifiedAt" (JD.nullable JD.string))
        (JD.field "deadline" JD.string)
        (JD.field "daysRemaining" JD.int)
        (JD.field "isOverdue" JD.bool)


complianceStatusDecoder : JD.Decoder ComplianceStatusResponse
complianceStatusDecoder =
    JD.map4 ComplianceStatusResponse
        (JD.field "w8benStatus" w8BenStatusDecoder)
        (JD.field "w8benExpiryDate" (JD.nullable JD.string))
        (JD.field "documents" (JD.list documentRecordDecoder))
        (JD.field "nppnStatus" nppnStatusDecoder)
