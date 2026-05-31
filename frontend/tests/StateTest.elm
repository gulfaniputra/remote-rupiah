module StateTest exposing (suite)

import Data.FxEfficiency as FxEfficiency
import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Data.Unrealized as Unrealized
import Expect
import Money
import Test exposing (Test, describe, test)


mockTx : Transaction
mockTx =
    { id = "tx-1"
    , date = "2026-05-18"
    , currency = "USD"
    , amountCents = Money.fromCents 5420000
    , withholdingCents = Money.fromCents 542000
    , actualIdrReceivedCents = Nothing
    , kmkRate = Just "16120.00"
    , is1042sVerified = False
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
    , kmkRate = Just "16120.00"
    , actualIdrCents = Just (Money.fromCents 1610000000)
    , spreadCents = Money.fromCents 5000000
    , source = Just "wise"
    }


suite : Test
suite =
    describe "Data.State"
        [ test "Ready accepts unrealized field" <|
            \_ ->
                Ready { txs = [ mockTx ], unrealized = [ mockUnrealized ], fxLeakage = [ mockFxEfficiency ] }
                    |> Expect.equal (Ready { txs = [ mockTx ], unrealized = [ mockUnrealized ], fxLeakage = [ mockFxEfficiency ] })
        ]
