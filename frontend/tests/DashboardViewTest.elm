module DashboardViewTest exposing (suite)

import Data.Compliance as C
import Data.State exposing (State(..))
import Expect
import Html.Attributes as Attr
import Money
import Test exposing (Test, describe, test)
import Test.Html.Event as Event
import Test.Html.Query as Query
import Test.Html.Selector as Selector
import View.Dashboard as Dashboard


type TestMsg
    = UserTriggeredNppnAction



-- Helper to reduce boilerplate for tests that don't need to track events


noOpHandlers : Dashboard.DashboardHandlers ()
noOpHandlers =
    { onSourceChange = \_ -> ()
    , onVerify = \_ -> ()
    , onUpload = ()
    , onNpwpChange = \_ -> ()
    , onNikChange = \_ -> ()
    , onAddressChange = \_ -> ()
    , onKluCodeChange = \_ -> ()
    , onSaveProfile = ()
    , onExport = ()
    , onNppnNotify = ()
    }


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
                    [ { date = "2026-05-18", amountCents = Money.fromCents 100000, amountIdrCents = Money.fromCents 1615000000, kmkRate = Just "16120.00", actualIdrCents = Just (Money.fromCents 1610000000), spreadCents = Money.fromCents 5000000, source = Just "wise" }
                    , { date = "2026-05-19", amountCents = Money.fromCents 200000, amountIdrCents = Money.fromCents 3222500000, kmkRate = Just "16120.00", actualIdrCents = Just (Money.fromCents 3220000000), spreadCents = Money.fromCents 2500000, source = Just "wise" }
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
                    Nothing
                    noOpHandlers
                    |> Query.fromHtml
                    |> Query.find [ Selector.tag "select" ]
                    |> Query.has [ Selector.attribute (Attr.value "wise") ]
        , test "renders tax profile inputs with values" <|
            \_ ->
                Dashboard.view
                    (Ready { txs = [], unrealized = [], fxLeakage = [] })
                    0
                    "wise"
                    ""
                    { npwp = "12.345.678.9-012.000", nik = "1234567890123456", address = "123 Sudirman", kluCode = "62010" }
                    Nothing
                    noOpHandlers
                    |> Query.fromHtml
                    |> (\html ->
                            Expect.all
                                [ \q -> q |> Query.find [ Selector.id "tax-npwp" ] |> Query.has [ Selector.attribute (Attr.value "12.345.678.9-012.000") ]
                                , \q -> q |> Query.find [ Selector.id "tax-nik" ] |> Query.has [ Selector.attribute (Attr.value "1234567890123456") ]
                                , \q -> q |> Query.find [ Selector.id "tax-address" ] |> Query.has [ Selector.attribute (Attr.value "123 Sudirman") ]
                                , \q -> q |> Query.find [ Selector.id "tax-klu" ] |> Query.has [ Selector.attribute (Attr.value "62010") ]
                                ]
                                html
                       )
        , test "displays validation error when NPWP or NIK is invalid length" <|
            \_ ->
                Dashboard.view
                    (Ready { txs = [], unrealized = [], fxLeakage = [] })
                    0
                    "wise"
                    ""
                    { npwp = "123", nik = "123", address = "123 Sudirman", kluCode = "62010" }
                    Nothing
                    noOpHandlers
                    |> Query.fromHtml
                    |> Query.findAll [ Selector.class "validation-error" ]
                    |> Query.first
                    |> Query.has [ Selector.text "NPWP must be 15 or 16 digits" ]
        , describe "NPPN alert"
            [ test "Overdue + not notified → view contains 'deadline missed'" <|
                \_ ->
                    let
                        nppnStatus =
                            { notified = False, notifiedAt = Nothing, deadline = "2026-03-31", daysRemaining = -5, isOverdue = True }

                        complianceStatus =
                            { w8benStatus = C.W8BenValid, w8benExpiryDate = Just "2099-12-31", documents = [], nppnStatus = nppnStatus }
                    in
                    Dashboard.view
                        (Ready { txs = [], unrealized = [], fxLeakage = [] })
                        0
                        "wise"
                        ""
                        { npwp = "", nik = "", address = "", kluCode = "" }
                        (Just complianceStatus)
                        noOpHandlers
                        |> Query.fromHtml
                        |> Query.has [ Selector.text "deadline missed" ]
            , test "14 days remaining + not notified → view contains 'due in'" <|
                \_ ->
                    let
                        nppnStatus =
                            { notified = False, notifiedAt = Nothing, deadline = "2026-03-31", daysRemaining = 14, isOverdue = False }

                        complianceStatus =
                            { w8benStatus = C.W8BenValid, w8benExpiryDate = Just "2099-12-31", documents = [], nppnStatus = nppnStatus }
                    in
                    Dashboard.view
                        (Ready { txs = [], unrealized = [], fxLeakage = [] })
                        0
                        "wise"
                        ""
                        { npwp = "", nik = "", address = "", kluCode = "" }
                        (Just complianceStatus)
                        noOpHandlers
                        |> Query.fromHtml
                        |> Query.has [ Selector.text "due in" ]
            , test "Notified → view contains 'NPPN filed'" <|
                \_ ->
                    let
                        nppnStatus =
                            { notified = True, notifiedAt = Just "2026-03-15T10:00:00Z", deadline = "2026-03-31", daysRemaining = 0, isOverdue = False }

                        complianceStatus =
                            { w8benStatus = C.W8BenValid, w8benExpiryDate = Just "2099-12-31", documents = [], nppnStatus = nppnStatus }
                    in
                    Dashboard.view
                        (Ready { txs = [], unrealized = [], fxLeakage = [] })
                        0
                        "wise"
                        ""
                        { npwp = "", nik = "", address = "", kluCode = "" }
                        (Just complianceStatus)
                        noOpHandlers
                        |> Query.fromHtml
                        |> Query.has [ Selector.text "✅ NPPN Notification filed with DJP" ]
            , test "Not notified → notify button click triggers onNppnNotify" <|
                \_ ->
                    let
                        nppnStatus =
                            { notified = False, notifiedAt = Nothing, deadline = "2026-03-31", daysRemaining = 30, isOverdue = False }

                        complianceStatus =
                            { w8benStatus = C.W8BenValid, w8benExpiryDate = Just "2099-12-31", documents = [], nppnStatus = nppnStatus }

                        handlers : Dashboard.DashboardHandlers TestMsg
                        handlers =
                            { onSourceChange = \_ -> UserTriggeredNppnAction
                            , onVerify = \_ -> UserTriggeredNppnAction
                            , onUpload = UserTriggeredNppnAction
                            , onNpwpChange = \_ -> UserTriggeredNppnAction
                            , onNikChange = \_ -> UserTriggeredNppnAction
                            , onAddressChange = \_ -> UserTriggeredNppnAction
                            , onKluCodeChange = \_ -> UserTriggeredNppnAction
                            , onSaveProfile = UserTriggeredNppnAction
                            , onExport = UserTriggeredNppnAction
                            , onNppnNotify = UserTriggeredNppnAction
                            }
                    in
                    Dashboard.view
                        (Ready { txs = [], unrealized = [], fxLeakage = [] })
                        0
                        "wise"
                        ""
                        { npwp = "", nik = "", address = "", kluCode = "" }
                        (Just complianceStatus)
                        handlers
                        |> Query.fromHtml
                        |> Query.find [ Selector.class "alert" ]
                        |> Query.find [ Selector.tag "button" ]
                        |> Event.simulate Event.click
                        |> Event.expect UserTriggeredNppnAction
            ]
        , describe "groupFxLeakageBySource"
            [ test "groups leakage by source correctly" <|
                \_ ->
                    let
                        fx1 =
                            { date = "2026-05-18"
                            , amountCents = Money.fromCents 100000
                            , amountIdrCents = Money.fromCents 1615000000
                            , kmkRate = Just "16120.00"
                            , actualIdrCents = Just (Money.fromCents 1610000000)
                            , spreadCents = Money.fromCents 5000000
                            , source = Just "wise"
                            }

                        fx2 =
                            { fx1 | spreadCents = Money.fromCents 2000000, source = Just "paypal" }

                        fx3 =
                            { fx1 | spreadCents = Money.fromCents 3000000, source = Just "wise" }

                        result =
                            Dashboard.groupFxLeakageBySource [ fx1, fx2, fx3 ]

                        expected =
                            [ ( "wise", Money.fromCents 8000000 )
                            , ( "paypal", Money.fromCents 2000000 )
                            ]

                        sortedResult =
                            List.sortBy Tuple.first result

                        sortedExpected =
                            List.sortBy Tuple.first expected
                    in
                    Expect.equal sortedResult sortedExpected
            , test "handles missing source as 'unknown'" <|
                \_ ->
                    let
                        fx =
                            { date = "2026-05-18"
                            , amountCents = Money.fromCents 100000
                            , amountIdrCents = Money.fromCents 1615000000
                            , kmkRate = Just "16120.00"
                            , actualIdrCents = Just (Money.fromCents 1610000000)
                            , spreadCents = Money.fromCents 5000000
                            , source = Nothing
                            }

                        result =
                            Dashboard.groupFxLeakageBySource [ fx ]
                    in
                    Expect.equal result [ ( "unknown", Money.fromCents 5000000 ) ]
            , test "returns empty list for empty input" <|
                \_ ->
                    Dashboard.groupFxLeakageBySource []
                        |> Expect.equal []
            ]
        ]
