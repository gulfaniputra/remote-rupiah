module CsvMapper exposing (Model, Msg(..), Status(..), init, update, view)

import Api
import Dict exposing (Dict)
import Html exposing (Html, button, div, h2, option, select, span, text)
import Html.Attributes exposing (class, value)
import Html.Events exposing (onClick, onInput)
import Http



-- MODEL


type alias Model =
    { token : String
    , mapping : Dict String String
    , sourceHeaders : List String
    , status : Status
    }


type Status
    = Idle
    | Loading
    | SaveOk
    | Failed String


init : String -> List String -> Model
init token headers =
    { token = token
    , mapping = Dict.empty
    , sourceHeaders = headers
    , status = Idle
    }



-- MSG


type Msg
    = FetchMapping
    | GotMapping (Result Http.Error (Maybe (Dict String String)))
    | SelectTarget String String
    | SaveMapping
    | MappingSaved (Result Http.Error ())



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        FetchMapping ->
            ( { model | status = Loading }
            , Api.fetchCsvMapping model.token GotMapping
            )

        GotMapping (Ok (Just m)) ->
            ( { model | mapping = m, status = Idle }, Cmd.none )

        GotMapping (Ok Nothing) ->
            ( { model | status = Idle }, Cmd.none )

        GotMapping (Err _) ->
            ( { model | status = Failed "Failed to load mapping" }, Cmd.none )

        SelectTarget header target ->
            ( { model | mapping = Dict.insert header target model.mapping }
            , Cmd.none
            )

        SaveMapping ->
            ( { model | status = Loading }
            , Api.saveCsvMapping model.token model.mapping MappingSaved
            )

        MappingSaved (Ok _) ->
            ( { model | status = SaveOk }, Cmd.none )

        MappingSaved (Err _) ->
            ( { model | status = Failed "Failed to save mapping" }, Cmd.none )



-- VIEW


canonicalTargets : List String
canonicalTargets =
    [ "", "date", "amount", "currency" ]


viewRow : Dict String String -> String -> Html Msg
viewRow mapping header =
    div [ class "mapper-row" ]
        [ span [ class "mapper-source" ] [ text header ]
        , span [ class "mapper-arrow" ] [ text "→" ]
        , div [ class "mapper-target" ]
            [ select
                [ onInput (SelectTarget header)
                , value (Dict.get header mapping |> Maybe.withDefault "")
                ]
                (List.map
                    (\t -> option [ value t ] [ text (if t == "" then "— skip —" else t) ])
                    canonicalTargets
                )
            ]
        , span
            [ class
                (if Dict.member header mapping then
                    "mapper-confidence conf-high"

                 else
                    "mapper-confidence conf-low"
                )
            ]
            [ text (if Dict.member header mapping then "✓" else "–") ]
        ]


view : Model -> Html Msg
view model =
    div [ class "mapper-card" ]
        [ div [ class "mapper-header" ]
            [ h2 [] [ text "CSV Field Mapping" ]
            , button [ class "btn", onClick FetchMapping ] [ text "Load Saved" ]
            ]
        , div [ class "mapper-grid" ]
            (List.map (viewRow model.mapping) model.sourceHeaders)
        , div [ class "mapper-footer" ]
            [ case model.status of
                Failed e ->
                    span [ class "text-danger text-sm" ] [ text e ]

                SaveOk ->
                    span [ class "text-success text-sm" ] [ text "Mapping saved." ]

                _ ->
                    text ""
            , button [ class "btn btn-primary", onClick SaveMapping ]
                [ text
                    (if model.status == Loading then
                        "Saving…"

                     else
                        "Save Mapping"
                    )
                ]
            ]
        ]
