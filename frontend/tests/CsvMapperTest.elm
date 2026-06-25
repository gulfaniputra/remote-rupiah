module CsvMapperTest exposing (suite)

import CsvMapper exposing (Model, Msg(..), Status(..), init, update)
import Dict
import Expect
import Fuzz
import Http
import Test exposing (..)


-- HELPERS


baseModel : Model
baseModel =
    init "http://localhost:8080" "test-token" [ "Date", "Amount", "Currency" ]


-- SUITE


suite : Test
suite =
    describe "CsvMapper"
        [ describe "initial state"
            [ test "mapping starts auto-matched" <|
                \_ ->
                    baseModel.mapping
                        |> Expect.equal (Dict.fromList [ ( "Amount", "amount" ), ( "Currency", "currency" ), ( "Date", "date" ) ])
            , test "status starts Idle" <|
                \_ ->
                    baseModel.status
                        |> Expect.equal Idle
            , test "sourceHeaders are stored" <|
                \_ ->
                    baseModel.sourceHeaders
                        |> Expect.equal [ "Date", "Amount", "Currency" ]
            , test "token is stored" <|
                \_ ->
                    baseModel.token
                        |> Expect.equal "test-token"
            ]
        , describe "header selection → mapping state update"
            [ test "SelectTarget inserts header→target into mapping" <|
                \_ ->
                    update (SelectTarget "Date" "date") baseModel
                        |> Tuple.first
                        |> .mapping
                        |> Dict.get "Date"
                        |> Expect.equal (Just "date")
            , test "SelectTarget overwrites previous selection" <|
                \_ ->
                    baseModel
                        |> update (SelectTarget "Date" "date")
                        |> Tuple.first
                        |> update (SelectTarget "Date" "amount")
                        |> Tuple.first
                        |> .mapping
                        |> Dict.get "Date"
                        |> Expect.equal (Just "amount")
            , test "SelectTarget preserves other mappings" <|
                \_ ->
                    baseModel
                        |> update (SelectTarget "Date" "date")
                        |> Tuple.first
                        |> update (SelectTarget "Amount" "amount")
                        |> Tuple.first
                        |> .mapping
                        |> Expect.equal (Dict.fromList [ ( "Amount", "amount" ), ( "Currency", "currency" ), ( "Date", "date" ) ])
            , fuzz Fuzz.string "fuzz: any string header can be mapped to a target" <|
                \header ->
                    update (SelectTarget header "currency") baseModel
                        |> Tuple.first
                        |> .mapping
                        |> Dict.get header
                        |> Expect.equal (Just "currency")
            ]
        , describe "API success decode"
            [ test "GotMapping Ok (Just map) merges mapping" <|
                \_ ->
                    let
                        incoming =
                            Dict.fromList [ ( "Date", "date" ), ( "Amt", "amount" ) ]
                    in
                    update (GotMapping (Ok (Just incoming))) baseModel
                        |> Tuple.first
                        |> .mapping
                        |> Expect.equal (Dict.fromList [ ( "Amount", "amount" ), ( "Amt", "amount" ), ( "Currency", "currency" ), ( "Date", "date" ) ])
            , test "GotMapping Ok (Just map) sets status Idle" <|
                \_ ->
                    update (GotMapping (Ok (Just Dict.empty))) baseModel
                        |> Tuple.first
                        |> .status
                        |> Expect.equal Idle
            , test "GotMapping Ok Nothing leaves mapping unchanged" <|
                \_ ->
                    let
                        withMapping =
                            update (SelectTarget "Date" "date") baseModel |> Tuple.first
                    in
                    update (GotMapping (Ok Nothing)) withMapping
                        |> Tuple.first
                        |> .mapping
                        |> Dict.get "Date"
                        |> Expect.equal (Just "date")
            , test "MappingSaved Ok sets status SaveOk" <|
                \_ ->
                    update (MappingSaved (Ok ())) baseModel
                        |> Tuple.first
                        |> .status
                        |> Expect.equal SaveOk
            ]
        , describe "API failure handling"
            [ test "GotMapping Err sets status Err" <|
                \_ ->
                    update (GotMapping (Err Http.NetworkError)) baseModel
                        |> Tuple.first
                        |> .status
                        |> Expect.equal (Failed "Failed to load mapping")
            , test "GotMapping Err preserves existing mapping" <|
                \_ ->
                    let
                        withMapping =
                            update (SelectTarget "Date" "date") baseModel |> Tuple.first
                    in
                    update (GotMapping (Err Http.NetworkError)) withMapping
                        |> Tuple.first
                        |> .mapping
                        |> Dict.get "Date"
                        |> Expect.equal (Just "date")
            , test "MappingSaved Err sets status Err" <|
                \_ ->
                    update (MappingSaved (Err Http.NetworkError)) baseModel
                        |> Tuple.first
                        |> .status
                        |> Expect.equal (Failed "Failed to save mapping")
            , test "FetchMapping sets status Loading" <|
                \_ ->
                    update FetchMapping baseModel
                        |> Tuple.first
                        |> .status
                        |> Expect.equal Loading
            ]
        ]
