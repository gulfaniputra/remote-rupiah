module Data.Unrealized exposing (Unrealized, decoder, listDecoder)

import Json.Decode as JD
import Money exposing (IDR, Money)


type alias Unrealized =
    { source : String
    , unrealizedIdrCents : Money IDR
    }


decoder : JD.Decoder Unrealized
decoder =
    JD.map2 Unrealized
        (JD.field "source" JD.string)
        (JD.field "unrealized_idr_cents" Money.decoder)


listDecoder : JD.Decoder (List Unrealized)
listDecoder =
    JD.field "positions" (JD.list decoder)
