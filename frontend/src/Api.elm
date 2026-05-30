module Api exposing (fetchTransactions, verify1042s, fetchCsvMapping, saveCsvMapping)

import Data.Transaction as Transaction exposing (Transaction)
import Http
import Dict exposing (Dict)
import Json.Decode as JD
import Json.Encode as JE


fetchTransactions : String -> (Result Http.Error (List Transaction) -> msg) -> Cmd msg
fetchTransactions token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/transactions"
        , body = Http.emptyBody
        , expect =
            Http.expectJson toMsg
                (JD.field "transactions" (JD.list Transaction.decoder))
        , timeout = Just 15000
        , tracker = Nothing
        }


verify1042s : String -> String -> (Result Http.Error () -> msg) -> Cmd msg
verify1042s token id toMsg =
    Http.request
        { method = "PATCH"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/transactions/" ++ id ++ "/verify"
        , body = Http.emptyBody
        , expect = Http.expectWhatever toMsg
        , timeout = Just 10000
        , tracker = Nothing
        }


decodeMapping : JD.Decoder (Maybe (Dict String String))
decodeMapping =
    JD.field "success" JD.bool
        |> JD.andThen (\success ->
            if success then
                JD.field "mapping" (JD.nullable (JD.dict JD.string))
            else
                JD.fail "API returned success = false"
        )


encodeMapping : Dict String String -> JE.Value
encodeMapping mapping =
    mapping
        |> Dict.toList
        |> List.map (\(k, v) -> (k, JE.string v))
        |> JE.object


fetchCsvMapping : String -> (Result Http.Error (Maybe (Dict String String)) -> msg) -> Cmd msg
fetchCsvMapping token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/csv/map"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg decodeMapping
        , timeout = Just 10000
        , tracker = Nothing
        }


saveCsvMapping : String -> Dict String String -> (Result Http.Error () -> msg) -> Cmd msg
saveCsvMapping token mapping toMsg =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/csv/map"
        , body = Http.jsonBody (encodeMapping mapping)
        , expect = Http.expectWhatever toMsg
        , timeout = Just 10000
        , tracker = Nothing
        }

