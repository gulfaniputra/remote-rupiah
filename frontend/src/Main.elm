port module Main exposing (Model, Msg(..), defaultCompliance, epoch, main, update)

import Api
import Browser
import Data.Compliance as C
import Data.FxEfficiency exposing (FxEfficiencyData)
import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Data.Unrealized exposing (Unrealized)
import Html exposing (..)
import Http
import Time
import View.Dashboard as D



-- PORTS


port clearCredentials : () -> Cmd msg



-- MODEL


type alias Model =
    { state : State
    , compliance : C.ComplianceStatus
    , t : Time.Posix
    , kmk : Maybe String
    , token : String
    , source : String
    }


defaultCompliance : C.ComplianceStatus
defaultCompliance =
    C.StandardRate


epoch : Time.Posix
epoch =
    Time.millisToPosix 0



-- MSG


type Msg
    = GotTransactions (Result Http.Error (List Transaction))
    | GotUnrealized (Result Http.Error (List Unrealized))
    | GotFxEfficiency (Result Http.Error (List FxEfficiencyData))
    | UpdateSource String
    | Verify String
    | Verified String (Result Http.Error ())
    | Tick Time.Posix
    | GotKmk (Result Http.Error String)



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg m =
    case msg of
        GotTransactions (Ok txs) ->
            ( { m
                | state =
                    case m.state of
                        Ready data ->
                            Ready { data | txs = txs }

                        _ ->
                            Ready { txs = txs, unrealized = [], fxLeakage = [] }
              }
            , Cmd.none
            )

        GotUnrealized (Ok unrealized) ->
            ( { m
                | state =
                    case m.state of
                        Ready data ->
                            Ready { data | unrealized = unrealized }

                        _ ->
                            Ready { txs = [], unrealized = unrealized, fxLeakage = [] }
              }
            , Cmd.none
            )

        GotFxEfficiency (Ok fxLeakage) ->
            ( { m
                | state =
                    case m.state of
                        Ready data ->
                            Ready { data | fxLeakage = fxLeakage }

                        _ ->
                            Ready { txs = [], unrealized = [], fxLeakage = fxLeakage }
              }
            , Cmd.none
            )

        GotUnrealized (Err _) ->
            ( m, Cmd.none )

        GotFxEfficiency (Err _) ->
            ( m, Cmd.none )

        UpdateSource source ->
            ( { m | source = source }, Cmd.none )

        GotTransactions (Err err) ->
            case err of
                Http.BadStatus 401 ->
                    ( { m | token = "", state = Failure "Session expired" }, clearCredentials () )

                _ ->
                    ( { m | state = Failure "Network error" }, Cmd.none )

        Verify id ->
            ( m, Api.verify1042s m.token id (Verified id) )

        Verified id (Ok _) ->
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

        Verified _ (Err _) ->
            -- Silently ignore failures to preserve UX state
            ( m, Cmd.none )

        Tick _ ->
            ( m, Cmd.none )

        GotKmk _ ->
            ( m, Cmd.none )



-- VIEW (Placeholder)


view : Model -> Html Msg
view m =
    case m.state of
        Loading ->
            div [] [ text "Loading..." ]

        Failure err ->
            div [] [ text ("Error: " ++ err) ]

        Ready data ->
            D.view
                (Ready data)
                (m.kmk |> Maybe.andThen String.toInt |> Maybe.withDefault 0)
                m.source
                UpdateSource
                Verify



-- MAIN


main : Program { token : String } Model Msg
main =
    Browser.element
        { init =
            \flags ->
                ( { state = Loading, compliance = defaultCompliance, t = epoch, kmk = Nothing, token = flags.token, source = "wise" }
                , Cmd.batch
                    [ Api.fetchUnrealized flags.token GotUnrealized
                    , Api.fetchFxEfficiency flags.token GotFxEfficiency
                    ]
                )
        , update = update
        , view = view
        , subscriptions = \_ -> Sub.none
        }
