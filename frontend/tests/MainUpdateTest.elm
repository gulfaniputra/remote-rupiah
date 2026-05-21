module MainUpdateTest exposing (..)

import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Expect
import Http
import Main
import Money
import Test exposing (..)


mockTx : Transaction
mockTx =
    { id = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
    , date = "2026-05-18"
    , currency = "USD"
    , amountCents = Money.fromCents 5420000
    , withholdingCents = Money.fromCents 542000
    , actualIdrReceivedCents = Nothing
    , kmkRate = Just "16120.00"
    , is1042sVerified = False
    }


loadingModel : Main.Model
loadingModel =
    { state = Loading
    , compliance = Main.defaultCompliance
    , t = Main.epoch
    , kmk = Nothing
    , token = "test-token"
    }


suite : Test
suite =
    describe "Main.update"
        [ test "GotTransactions Ok transitions Loading → Ready" <|
            \_ ->
                Main.update (Main.GotTransactions (Ok [ mockTx ])) loadingModel
                    |> Tuple.first
                    |> .state
                    |> Expect.equal (Ready { txs = [ mockTx ] })
        , test "GotTransactions Err BadStatus 401 transitions to Failure with session expired" <|
            \_ ->
                Main.update (Main.GotTransactions (Err (Http.BadStatus 401))) loadingModel
                    |> Tuple.first
                    |> .state
                    |> Expect.equal (Failure "Session expired")
        , test "GotTransactions Err BadStatus 401 clears token" <|
            \_ ->
                Main.update (Main.GotTransactions (Err (Http.BadStatus 401))) loadingModel
                    |> Tuple.first
                    |> .token
                    |> Expect.equal ""
        , test "GotTransactions Err NetworkError transitions to Failure" <|
            \_ ->
                Main.update (Main.GotTransactions (Err Http.NetworkError)) loadingModel
                    |> Tuple.first
                    |> .state
                    |> Expect.equal (Failure "Network error")
        , test "Ready state with empty list" <|
            \_ ->
                Main.update (Main.GotTransactions (Ok [])) loadingModel
                    |> Tuple.first
                    |> .state
                    |> Expect.equal (Ready { txs = [] })
        ]
