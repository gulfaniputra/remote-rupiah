port module Main exposing (Model, Msg(..), main, update, defaultCompliance, epoch)

import Api
import Browser
import Data.Compliance as C
import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Html exposing (..)
import Html.Attributes exposing (..)
import Http
import Json.Decode as JD
import Money as M
import Svg exposing (path, svg)
import Svg.Attributes as SA
import TaxLogic as T
import Time
import View.Dashboard as D


port clearCredentials : () -> Cmd msg


type alias Flags =
    { token : String }


type alias Model =
    { state : State
    , compliance : C.ComplianceStatus
    , t : Time.Posix
    , kmk : Maybe String
    , token : String
    }


type Msg
    = GotTransactions (Result Http.Error (List Transaction))
    | Verify String
    | Tick Time.Posix
    | GotKmk (Result Http.Error String)


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , subscriptions = \_ -> Time.every 1000 Tick
        , view = view
        }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { state = Loading
      , compliance = C.StandardRate
      , t = Time.millisToPosix 0
      , kmk = Nothing
      , token = flags.token
      }
    , Cmd.batch
        [ Api.fetchTransactions flags.token GotTransactions
        , Http.get
            { url = "/api/kmk/latest"
            , expect = Http.expectJson GotKmk (JD.at [ "data", "midRate" ] JD.string)
            }
        ]
    )


update : Msg -> Model -> ( Model, Cmd Msg )
update msg m =
    case msg of
        GotTransactions (Ok txs) ->
            ( { m | state = Ready { txs = txs } }, Cmd.none )

        GotTransactions (Err (Http.BadStatus 401)) ->
            ( { m | state = Failure "Session expired", token = "" }
            , clearCredentials ()
            )

        GotTransactions (Err err) ->
            ( { m | state = Failure (httpErrStr err) }, Cmd.none )

        Verify id ->
            case m.state of
                Ready data ->
                    ( { m
                        | state =
                            Ready
                                { data
                                    | txs =
                                        List.map
                                            (\tx ->
                                                if tx.id == id then
                                                    { tx | is1042sVerified = True }

                                                else
                                                    tx
                                            )
                                            data.txs
                                }
                      }
                    , Cmd.none
                    )

                _ ->
                    ( m, Cmd.none )

        Tick t ->
            ( { m
                | t = t
                , compliance =
                    C.calculateStatus
                        { deadlineYear = 2026, deadlineMonth = Time.Mar }
                        t
                        Time.utc
              }
            , Cmd.none
            )

        GotKmk res ->
            case res of
                Ok rate ->
                    ( { m | kmk = Just rate }, Cmd.none )

                Err _ ->
                    ( m, Cmd.none )


defaultCompliance : C.ComplianceStatus
defaultCompliance =
    C.StandardRate


epoch : Time.Posix
epoch =
    Time.millisToPosix 0


httpErrStr : Http.Error -> String
httpErrStr err =
    case err of
        Http.BadUrl u ->
            "Bad URL: " ++ u

        Http.Timeout ->
            "Request timed out"

        Http.NetworkError ->
            "Network error"

        Http.BadStatus code ->
            "Server error: " ++ String.fromInt code

        Http.BadBody msg_ ->
            "Bad response: " ++ msg_


view : Model -> Html Msg
view m =
    let
        kmkStr =
            Maybe.withDefault "16120.00" m.kmk

        kmkVal =
            String.toFloat kmkStr |> Maybe.withDefault 16120.0 |> round

        banner =
            case m.compliance of
                C.ActionRequired { urgency } ->
                    if urgency == C.Urgent then
                        div [ class "banner banner-urgent sticky top-0 z-50" ]
                            [ text "🚨 ACTION REQUIRED: NPPN Notification Deadline is March 31st!" ]

                    else
                        text ""

                _ ->
                    text ""
    in
    div []
        [ banner
        , div [ class "topbar" ]
            [ div [ class "flex items-center gap-4" ]
                [ svg
                    [ SA.width "24"
                    , SA.height "24"
                    , SA.viewBox "0 0 24 24"
                    , SA.fill "none"
                    , SA.stroke "currentColor"
                    , SA.strokeWidth "2"
                    ]
                    [ path [ SA.d "M2 12L12 2L22 12L12 22L2 12Z" ] [] ]
                , b [] [ text "REMOTE-RUPIAH" ]
                ]
            ]
        , div [ class "container" ]
            [ div [ class "dashboard-header" ]
                [ h1 [] [ text "Dashboard" ]
                , div [ class "kmk-rate" ]
                    [ div [ class "rate" ] [ text ("1 USD = Rp " ++ kmkStr) ] ]
                ]
            , D.view m.state kmkVal Verify
            ]
        ]
