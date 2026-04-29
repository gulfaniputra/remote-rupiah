module Data.Ingestion exposing (IngestedRecord(..), decoder)

import Json.Decode as D exposing (Decoder)
import Money as M

type IngestedRecord = Ready R | MissingRate R | Duplicate R

type alias R = { id : String, date : String, amount : M.Money, cur : String }

decoder : Decoder IngestedRecord
decoder =
    D.map5 (\i d a c s -> ( i, d, M.fromCents a, c, s ))
        (D.field "external_id" D.string)
        (D.field "date" D.string)
        (D.field "amount_cents" D.int)
        (D.field "currency" D.string)
        (D.field "ingestion_state" D.string)
        |> D.andThen (\( i, d, a, c, s ) ->
            let r = { id = i, date = d, amount = a, cur = c } in
            case s of
                "READY" -> D.succeed (Ready r)
                "MISSING_RATE" -> D.succeed (MissingRate r)
                "DUPLICATE" -> D.succeed (Duplicate r)
                _ -> D.fail "Err")
