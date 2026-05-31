module Data.FxEfficiency exposing (FxEfficiencyData, decoder, listDecoder)

import Json.Decode as JD
import Money exposing (IDR, Money, USD)


type alias FxEfficiencyData =
    { date : String
    , amountCents : Money USD
    , kmkRate : Maybe String
    , actualIdrCents : Maybe (Money IDR)
    , spreadCents : Money IDR
    , source : Maybe String
    }


decoder : JD.Decoder FxEfficiencyData
decoder =
    JD.map6 FxEfficiencyData
        (JD.field "date" JD.string)
        (JD.field "amount_cents" Money.decoder)
        (JD.field "kmk_rate" (JD.nullable JD.string))
        (JD.field "actual_idr_cents" (JD.nullable Money.decoder))
        (JD.field "spread_cents" Money.decoder)
        (JD.field "source" (JD.nullable JD.string))


listDecoder : JD.Decoder (List FxEfficiencyData)
listDecoder =
    JD.field "fxData" (JD.list decoder)
