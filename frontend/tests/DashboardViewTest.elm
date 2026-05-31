module DashboardViewTest exposing (suite)

import Expect
import Money
import Test exposing (Test, describe, test)
import View.Dashboard as Dashboard


suite : Test
suite =
    describe "View.Dashboard"
        [ test "totalUnrealized aggregates the dashboard value" <|
            \_ ->
                Dashboard.totalUnrealized
                    [ { source = "wise", unrealizedIdrCents = Money.fromCents 100000000 }
                    , { source = "wise", unrealizedIdrCents = Money.fromCents 25000000 }
                    ]
                    |> Money.toCents
                    |> Expect.equal 125000000
        , test "totalFxLeakage aggregates the dashboard value" <|
            \_ ->
                Dashboard.totalFxLeakage
                    [ { date = "2026-05-18", amountCents = Money.fromCents 100000, kmkRate = Just "16120.00", actualIdrCents = Just (Money.fromCents 1610000000), spreadCents = Money.fromCents 5000000, source = Just "wise" }
                    , { date = "2026-05-19", amountCents = Money.fromCents 200000, kmkRate = Just "16120.00", actualIdrCents = Just (Money.fromCentsStr "3220000000"), spreadCents = Money.fromCents 2500000, source = Just "wise" }
                    ]
                    |> Money.toCents
                    |> Expect.equal 7500000
        , test "totalUnrealized returns zero for empty input" <|
            \_ ->
                Dashboard.totalUnrealized []
                    |> Money.toCents
                    |> Expect.equal 0
        , test "totalFxLeakage returns zero for empty input" <|
            \_ ->
                Dashboard.totalFxLeakage []
                    |> Money.toCents
                    |> Expect.equal 0
        ]
