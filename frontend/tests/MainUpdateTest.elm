module MainUpdateTest exposing (suite)

import Api
import Data.Compliance as C
import Data.FxEfficiency as FxEfficiency
import Data.State exposing (State(..))
import Data.TaxProfile as TaxProfile
import Data.Transaction exposing (Transaction)
import Data.Unrealized as Unrealized
import Expect
import Http
import Main
import Money
import Test exposing (Test, describe, test)


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
    { appState = Loading
    , complianceStatus = Nothing
    , t = Main.epoch
    , kmk = Nothing
    , token = "test-token"
    , apiUrl = "http://localhost:8080"
    , source = "wise"
    , uploadStatus = ""
    , taxProfile = TaxProfile.empty
    }


mockUnrealized : Unrealized.Unrealized
mockUnrealized =
    { source = "wise"
    , unrealizedIdrCents = Money.fromCents 100000000
    }


mockFxEfficiency : FxEfficiency.FxEfficiencyData
mockFxEfficiency =
    { date = "2026-05-18"
    , amountCents = Money.fromCents 100000
    , amountIdrCents = Money.fromCents 1615000000
    , kmkRate = Just "16120.00"
    , actualIdrCents = Just (Money.fromCents 1610000000)
    , spreadCents = Money.fromCents 5000000
    , source = Just "wise"
    }


suite : Test
suite =
    describe "Main.update"
        [ test "GotTransactions Ok transitions Loading → Ready" <|
            \_ ->
                Main.update (Main.GotTransactions (Ok [ mockTx ])) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (Ready { txs = [ mockTx ], unrealized = [], fxLeakage = [] })
        , test "GotUnrealized Ok transitions Loading → Ready" <|
            \_ ->
                Main.update (Main.GotUnrealized (Ok [ mockUnrealized ])) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (Ready { txs = [], unrealized = [ mockUnrealized ], fxLeakage = [] })
        , test "GotFxEfficiency Ok transitions Loading → Ready" <|
            \_ ->
                Main.update (Main.GotFxEfficiency (Ok [ mockFxEfficiency ])) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (Ready { txs = [], unrealized = [], fxLeakage = [ mockFxEfficiency ] })
        , test "GotTransactions Err BadStatus 401 transitions to Failure with session expired" <|
            \_ ->
                Main.update (Main.GotTransactions (Err Api.SessionExpired)) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (Failure "Session expired")
        , test "GotTransactions Err BadStatus 401 clears token" <|
            \_ ->
                Main.update (Main.GotTransactions (Err Api.SessionExpired)) loadingModel
                    |> Tuple.first
                    |> .token
                    |> Expect.equal ""
        , test "GotTransactions Err NetworkError transitions to Failure" <|
            \_ ->
                Main.update (Main.GotTransactions (Err Api.NetworkError)) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (Failure "Network error")
        , test "GotTransactions Err MappingRequired transitions to MappingRequired" <|
            \_ ->
                Main.update (Main.GotTransactions (Err (Api.MappingRequired [ "Posted At", "Net Amount", "Currency" ]))) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (MappingRequired { headers = [ "Posted At", "Net Amount", "Currency" ] })
        , test "Ready state with empty list" <|
            \_ ->
                Main.update (Main.GotTransactions (Ok [])) loadingModel
                    |> Tuple.first
                    |> .appState
                    |> Expect.equal (Ready { txs = [], unrealized = [], fxLeakage = [] })
        , test "UpdateSource mutates selected source" <|
            \_ ->
                Main.update (Main.UpdateSource "bank") loadingModel
                    |> Tuple.first
                    |> .source
                    |> Expect.equal "bank"
        , test "Export message sets status to Exporting..." <|
            \_ ->
                Main.update (Main.Export 2026) loadingModel
                    |> Tuple.first
                    |> .uploadStatus
                    |> Expect.equal "Exporting SPT..."
        , describe "NPPN Notify"
            [ test "NppnNotify sets uploadStatus to 'Notifying NPPN...'" <|
                \_ ->
                    Main.update Main.NppnNotify loadingModel
                        |> Tuple.first
                        |> .uploadStatus
                        |> Expect.equal "Notifying NPPN..."
            , test "GotNppnNotify Ok updates complianceStatus" <|
                \_ ->
                    let
                        nppnStatus =
                            { notified = True
                            , notifiedAt = Just "2026-03-15T10:00:00Z"
                            , deadline = "2026-03-31"
                            , daysRemaining = 0
                            , isOverdue = False
                            }

                        complianceResponse : C.ComplianceStatusResponse
                        complianceResponse =
                            { w8benStatus = C.W8BenValid
                            , w8benExpiryDate = Just "2099-12-31"
                            , documents = []
                            , nppnStatus = nppnStatus
                            }
                    in
                    Main.update (Main.GotNppnNotify (Ok complianceResponse)) loadingModel
                        |> Tuple.first
                        |> .uploadStatus
                        |> Expect.equal "NPPN notified!"
            , test "GotNppnNotify Err sets uploadStatus to error message" <|
                \_ ->
                    Main.update (Main.GotNppnNotify (Err Http.NetworkError)) loadingModel
                        |> Tuple.first
                        |> .uploadStatus
                        |> Expect.equal "NPPN notification failed"
            ]
        ]
