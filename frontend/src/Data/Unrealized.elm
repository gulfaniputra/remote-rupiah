module Data.Unrealized exposing (Unrealized, decoder, listDecoder)

import Json.Decode as JD


type alias Unrealized =
    { source : String
    , unrealizedIdrCents : String
    }


decoder : JD.Decoder Unrealized
decoder =
    JD.map2 Unrealized
        (JD.field "source" JD.string)
        (JD.field "unrealized_idr_cents" JD.string)


listDecoder : JD.Decoder (List Unrealized)
listDecoder =
    JD.field "positions" (JD.list decoder)
