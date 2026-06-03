module Api exposing (TransactionFetchError(..), decodeMappingRequired, fetchCsvMapping, fetchFxEfficiency, fetchTransactions, fetchUnrealized, saveCsvMapping, verify1042s)

import Data.FxEfficiency as FxEfficiency exposing (FxEfficiencyData)
import Data.Transaction as Transaction exposing (Transaction)
import Data.Unrealized as Unrealized exposing (Unrealized)
import Dict exposing (Dict)
import Http
import Json.Decode as JD
import Json.Encode as JE


type TransactionFetchError
    = SessionExpired
    | MappingRequired (List String)
    | NetworkError


decodeMappingRequired : JD.Decoder (List String)
decodeMappingRequired =
    JD.field "headers" (JD.list JD.string)


fetchTransactions : String -> (Result TransactionFetchError (List Transaction) -> msg) -> Cmd msg
fetchTransactions token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/transactions"
        , body = Http.emptyBody
        , expect =
            Http.expectStringResponse toMsg
                (\response ->
                    case response of
                        Http.GoodStatus_ _ body ->
                            JD.decodeString
                                (JD.field "transactions" (JD.list Transaction.decoder))
                                body
                                |> Result.mapError (\_ -> NetworkError)

                        Http.BadStatus_ metadata body ->
                            if metadata.statusCode == 428 then
                                JD.decodeString decodeMappingRequired body
                                    |> Result.mapError (\_ -> NetworkError)
                                    |> Result.andThen (\headers -> Err (MappingRequired headers))

                            else if metadata.statusCode == 401 then
                                Err SessionExpired

                            else
                                Err NetworkError

                        _ ->
                            Err NetworkError
                )
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
        |> JD.andThen
            (\success ->
                if success then
                    JD.field "mapping" (JD.nullable (JD.dict JD.string))

                else
                    JD.fail "API returned success = false"
            )


encodeMapping : Dict String String -> JE.Value
encodeMapping mapping =
    mapping
        |> Dict.toList
        |> List.map (\( k, v ) -> ( k, JE.string v ))
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


fetchUnrealized : String -> (Result Http.Error (List Unrealized) -> msg) -> Cmd msg
fetchUnrealized token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/wealth/unrealized"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg Unrealized.listDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }


fetchFxEfficiency : String -> (Result Http.Error (List FxEfficiencyData) -> msg) -> Cmd msg
fetchFxEfficiency token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = "/api/forecast/fx-efficiency"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg FxEfficiency.listDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }
