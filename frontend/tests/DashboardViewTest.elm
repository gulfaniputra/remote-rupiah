module DashboardViewTest exposing (suite)

import Data.FxEfficiency as FxEfficiency
import Data.State exposing (State(..))
import Expect
import Html.Attributes as Attr
import Money
import Test exposing (Test, describe, test)
import Test.Html.Query as Query
import Test.Html.Selector as Selector
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
        , test "renders wallet source selector" <|
            \_ ->
                Dashboard.view
                    (Ready { txs = [], unrealized = [], fxLeakage = [] })
                    0
                    "wise"
                    ""
                    { npwp = "", nik = "", address = "", kluCode = "" }
                    { onSourceChange = \_ -> ()
                    , onVerify = \_ -> ()
                    , onUpload = ()
                    , onNpwpChange = \_ -> ()
                    , onNikChange = \_ -> ()
                    , onAddressChange = \_ -> ()
                    , onKluCodeChange = \_ -> ()
                    , onSaveProfile = ()
                    , onExport = ()
                    }
                    |> Query.fromHtml
                    |> Query.find [ Selector.tag "select" ]
                    |> Query.has [ Selector.attribute (Attr.value "wise") ]
        , test "renders tax profile inputs with values" <|
            \_ ->
                let
                    html =
                        Dashboard.view
                            (Ready { txs = [], unrealized = [], fxLeakage = [] })
                            0
                            "wise"
                            ""
                            { npwp = "12.345.678.9-012.000", nik = "1234567890123456", address = "123 Sudirman", kluCode = "62010" }
                            { onSourceChange = \_ -> ()
                            , onVerify = \_ -> ()
                            , onUpload = ()
                            , onNpwpChange = \_ -> ()
                            , onNikChange = \_ -> ()
                            , onAddressChange = \_ -> ()
                            , onKluCodeChange = \_ -> ()
                            , onSaveProfile = ()
                            , onExport = ()
                            }
                            |> Query.fromHtml
                in
                Expect.all
                    [ \q -> q |> Query.find [ Selector.id "tax-npwp" ] |> Query.has [ Selector.attribute (Attr.value "12.345.678.9-012.000") ]
                    , \q -> q |> Query.find [ Selector.id "tax-nik" ] |> Query.has [ Selector.attribute (Attr.value "1234567890123456") ]
                    , \q -> q |> Query.find [ Selector.id "tax-address" ] |> Query.has [ Selector.attribute (Attr.value "123 Sudirman") ]
                    , \q -> q |> Query.find [ Selector.id "tax-klu" ] |> Query.has [ Selector.attribute (Attr.value "62010") ]
                    ]
                    html
        , test "displays validation error when NPWP or NIK is invalid length" <|
            \_ ->
                Dashboard.view
                    (Ready { txs = [], unrealized = [], fxLeakage = [] })
                    0
                    "wise"
                    ""
                    { npwp = "123", nik = "123", address = "123 Sudirman", kluCode = "62010" }
                    { onSourceChange = \_ -> ()
                    , onVerify = \_ -> ()
                    , onUpload = ()
                    , onNpwpChange = \_ -> ()
                    , onNikChange = \_ -> ()
                    , onAddressChange = \_ -> ()
                    , onKluCodeChange = \_ -> ()
                    , onSaveProfile = ()
                    , onExport = ()
                    }
                    |> Query.fromHtml
                    |> Query.findAll [ Selector.class "validation-error" ]
                    |> Query.first
                    |> Query.has [ Selector.text "NPWP must be 15 or 16 digits" ]
        ]
