module Api exposing (fetchTransactions, verify1042s)

import Data.Transaction as Transaction exposing (Transaction)
import Http
import Json.Decode as JD


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
