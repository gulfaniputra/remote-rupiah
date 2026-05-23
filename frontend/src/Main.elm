port module Main exposing (Model, Msg(..), defaultCompliance, epoch, main, update)

import Api
import Browser
import Data.Compliance as C
import Data.State exposing (State(..))
import Data.Transaction exposing (Transaction)
import Html exposing (..)
import Http
import Json.Decode as JD
import Money as M
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
    | Verify String
    | Verified String (Result Http.Error ())
    | Tick Time.Posix
    | GotKmk (Result Http.Error String)



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg m =
    case msg of
        GotTransactions (Ok txs) ->
            ( { m | state = Ready { txs = txs } }, Cmd.none )

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
            D.render m data



-- MAIN


main : Program { token : String } Model Msg
main =
    Browser.element
        { init = \flags -> ( { state = Loading, compliance = defaultCompliance, t = epoch, kmk = Nothing, token = flags.token }, Cmd.none )
        , update = update
        , view = view
        , subscriptions = \_ -> Sub.none
        }
