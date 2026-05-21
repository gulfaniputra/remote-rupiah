module Data.Transaction exposing (Transaction, decoder, listDecoder)

import Json.Decode as JD
import Money exposing (IDR, Money)


type alias Transaction =
    { id : String
    , date : String
    , currency : String
    , amountCents : Money IDR
    , withholdingCents : Money IDR
    , actualIdrReceivedCents : Maybe (Money IDR)
    , kmkRate : Maybe String
    , is1042sVerified : Bool
    }


decoder : JD.Decoder Transaction
decoder =
    JD.map8 Transaction
        (JD.field "id" JD.string)
        (JD.field "date" JD.string)
        (JD.field "currency" JD.string)
        (JD.field "amount_cents" Money.decoder)
        (JD.field "withholding_cents" Money.decoder)
        (JD.field "actual_idr_received_cents" (JD.nullable Money.decoder))
        (JD.field "kmk_rate" (JD.nullable JD.string))
        (JD.field "is_1042s_verified" JD.bool)


listDecoder : JD.Decoder (List Transaction)
listDecoder =
    JD.field "transactions" (JD.list decoder)
