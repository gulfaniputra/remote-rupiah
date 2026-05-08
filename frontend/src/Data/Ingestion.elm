module Data.Ingestion exposing (IngestedRecord(..), decoder)

import Json.Decode as D exposing (Decoder)
import Money as M

type IngestedRecord
    = Ready R 
    | MissingRate R 
    | Duplicate R 
    | PendingRate { date : String, currency : String, rawAmount : M.Money, raw : D.Value }

type alias R = { id : String, date : String, amount : M.Money, cur : String, raw : D.Value }

decoder : Decoder IngestedRecord
decoder =
    D.map6 (\i d a c s w -> ( s, { id = i, date = d, amount = M.fromCents a, cur = c, raw = w } ))
        (D.field "external_id" D.string) (D.field "date" D.string) (D.field "amount_cents" D.int) (D.field "currency" D.string) (D.field "ingestion_state" D.string) D.value
        |> D.andThen (\( s, r ) ->
            case s of
                "READY" -> D.succeed (Ready r)
                "MISSING_RATE" -> D.succeed (MissingRate r)
                "DUPLICATE" -> D.succeed (Duplicate r)
                "PENDING_RATE" -> D.succeed (PendingRate { date = r.date, currency = r.cur, rawAmount = r.amount, raw = r.raw })
                _ -> D.fail "E")
