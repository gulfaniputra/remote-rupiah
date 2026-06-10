module Api exposing (TransactionFetchError(..), decodeMappingRequired, exportDjp, fetchComplianceStatus, fetchCsvMapping, fetchFxEfficiency, fetchTaxProfile, fetchTransactions, fetchUnrealized, notifyNppn, saveCsvMapping, saveTaxProfile, verify1042s)

import Data.Compliance as Compliance
import Data.FxEfficiency as FxEfficiency exposing (FxEfficiencyData)
import Data.TaxProfile as TaxProfile exposing (TaxProfile)
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


fetchTransactions : String -> String -> (Result TransactionFetchError (List Transaction) -> msg) -> Cmd msg
fetchTransactions apiUrl token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/transactions"
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


verify1042s : String -> String -> String -> (Result Http.Error () -> msg) -> Cmd msg
verify1042s apiUrl token id toMsg =
    Http.request
        { method = "PATCH"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/transactions/" ++ id ++ "/verify"
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


fetchCsvMapping : String -> String -> (Result Http.Error (Maybe (Dict String String)) -> msg) -> Cmd msg
fetchCsvMapping apiUrl token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/csv/map"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg decodeMapping
        , timeout = Just 10000
        , tracker = Nothing
        }


saveCsvMapping : String -> String -> Dict String String -> (Result Http.Error () -> msg) -> Cmd msg
saveCsvMapping apiUrl token mapping toMsg =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/csv/map"
        , body = Http.jsonBody (encodeMapping mapping)
        , expect = Http.expectWhatever toMsg
        , timeout = Just 10000
        , tracker = Nothing
        }


fetchUnrealized : String -> String -> (Result Http.Error (List Unrealized) -> msg) -> Cmd msg
fetchUnrealized apiUrl token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/wealth/unrealized"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg Unrealized.listDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }


fetchFxEfficiency : String -> String -> (Result Http.Error (List FxEfficiencyData) -> msg) -> Cmd msg
fetchFxEfficiency apiUrl token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/forecast/fx-efficiency"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg FxEfficiency.listDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }


fetchTaxProfile : String -> String -> (Result Http.Error (Maybe TaxProfile) -> msg) -> Cmd msg
fetchTaxProfile apiUrl token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/tax-profile" -- Fixed typo: added missing slash "/"
        , body = Http.emptyBody
        , expect =
            Http.expectJson toMsg
                (JD.field "data" (JD.nullable TaxProfile.decoder))
        , timeout = Just 10000
        , tracker = Nothing
        }


saveTaxProfile : String -> String -> TaxProfile -> (Result Http.Error TaxProfile -> msg) -> Cmd msg
saveTaxProfile apiUrl token profile toMsg =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/tax-profile" -- Fixed typo: added missing slash "/"
        , body = Http.jsonBody (TaxProfile.encoder profile)
        , expect =
            Http.expectJson toMsg
                (JD.field "data" TaxProfile.decoder)
        , timeout = Just 10000
        , tracker = Nothing
        }


exportDjp : String -> String -> Int -> (Result Http.Error String -> msg) -> Cmd msg
exportDjp apiUrl token year toMsg =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/export/djp"
        , body = Http.jsonBody (JE.object [ ( "year", JE.int year ) ])
        , expect = Http.expectString toMsg
        , timeout = Just 15000
        , tracker = Nothing
        }


notifyNppn : String -> String -> (Result Http.Error Compliance.ComplianceStatusResponse -> msg) -> Cmd msg
notifyNppn apiUrl token toMsg =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/compliance/nppn/notify"
        , body = Http.jsonBody (JE.object [ ( "confirm", JE.bool True ) ])
        , expect = Http.expectJson toMsg Compliance.complianceStatusDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }


fetchComplianceStatus : String -> String -> (Result Http.Error Compliance.ComplianceStatusResponse -> msg) -> Cmd msg
fetchComplianceStatus apiUrl token toMsg =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = apiUrl ++ "/api/compliance/status"
        , body = Http.emptyBody
        , expect = Http.expectJson toMsg Compliance.complianceStatusDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }
