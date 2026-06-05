port module Main exposing (Model, Msg(..), defaultCompliance, epoch, main, update)

import Api
import Browser
import CsvMapper
import Data.Compliance as C
import Data.FxEfficiency exposing (FxEfficiencyData)
import Data.State exposing (State(..))
import Data.TaxProfile as TaxProfile exposing (TaxProfile)
import Data.Transaction exposing (Transaction)
import Data.Unrealized exposing (Unrealized)
import Html exposing (..)
import Http
import Time
import View.Dashboard as D



-- PORTS


port clearCredentials : () -> Cmd msg


port requestCsvFile : () -> Cmd msg


port uploadCsv : { token : String, csv : String } -> Cmd msg


port csvSelected : (String -> msg) -> Sub msg


port uploadCompleted : (String -> msg) -> Sub msg


port downloadCsv : { filename : String, content : String } -> Cmd msg



-- MODEL


type alias Model =
    { state : State
    , compliance : C.ComplianceStatus
    , complianceStatus : Maybe C.ComplianceStatusResponse
    , t : Time.Posix
    , kmk : Maybe String
    , token : String
    , source : String
    , uploadStatus : String
    , taxProfile : TaxProfile
    }


defaultCompliance : C.ComplianceStatus
defaultCompliance =
    C.StandardRate


epoch : Time.Posix
epoch =
    Time.millisToPosix 0



-- MSG


type Msg
    = GotTransactions (Result Api.TransactionFetchError (List Transaction))
    | GotUnrealized (Result Http.Error (List Unrealized))
    | GotFxEfficiency (Result Http.Error (List FxEfficiencyData))
    | CsvMapperMsg CsvMapper.Msg
    | UpdateSource String
    | Verify String
    | Verified String (Result Http.Error ())
    | Tick Time.Posix
    | GotKmk (Result Http.Error String)
    | RequestCsvUpload
    | FileSelected String
    | FileUploadCompleted String
    | GotTaxProfile (Result Http.Error (Maybe TaxProfile))
    | GotComplianceStatus (Result Http.Error C.ComplianceStatusResponse)
    | UpdateNpwp String
    | UpdateNik String
    | UpdateAddress String
    | UpdateKluCode String
    | SaveTaxProfile
    | GotSaveTaxProfile (Result Http.Error TaxProfile)
    | Export Int
    | GotExportDjp (Result Http.Error String)



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

        RequestCsvUpload ->
            ( m, requestCsvFile () )

        FileSelected csv ->
            ( { m | uploadStatus = "Uploading CSV..." }, uploadCsv { token = m.token, csv = csv } )

        FileUploadCompleted result ->
            ( { m | uploadStatus = result }, Cmd.none )

        GotTransactions (Err err) ->
            case err of
                Api.SessionExpired ->
                    ( { m | token = "", state = Failure "Session expired" }, clearCredentials () )

                Api.MappingRequired headers ->
                    ( { m | state = MappingRequired { headers = headers } }, Cmd.none )

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

        CsvMapperMsg _ ->
            ( m, Cmd.none )

        GotTaxProfile (Ok maybeProfile) ->
            ( { m | taxProfile = maybeProfile |> Maybe.withDefault TaxProfile.empty }, Cmd.none )

        GotTaxProfile (Err _) ->
            ( m, Cmd.none )

        GotComplianceStatus (Ok status) ->
            ( { m | complianceStatus = Just status }, Cmd.none )

        GotComplianceStatus (Err _) ->
            ( m, Cmd.none )

        UpdateNpwp npwp ->
            let
                p =
                    m.taxProfile

                newP =
                    { p | npwp = npwp }
            in
            ( { m | taxProfile = newP }, Cmd.none )

        UpdateNik nik ->
            let
                p =
                    m.taxProfile

                newP =
                    { p | nik = nik }
            in
            ( { m | taxProfile = newP }, Cmd.none )

        UpdateAddress address ->
            let
                p =
                    m.taxProfile

                newP =
                    { p | address = address }
            in
            ( { m | taxProfile = newP }, Cmd.none )

        UpdateKluCode kluCode ->
            let
                p =
                    m.taxProfile

                newP =
                    { p | kluCode = kluCode }
            in
            ( { m | taxProfile = newP }, Cmd.none )

        SaveTaxProfile ->
            ( { m | uploadStatus = "Saving profile..." }
            , Api.saveTaxProfile m.token m.taxProfile GotSaveTaxProfile
            )

        GotSaveTaxProfile (Ok savedProfile) ->
            ( { m | taxProfile = savedProfile, uploadStatus = "Profile saved!" }, Cmd.none )

        GotSaveTaxProfile (Err _) ->
            ( { m | uploadStatus = "Failed to save profile." }, Cmd.none )

        Export year ->
            ( { m | uploadStatus = "Exporting SPT..." }
            , Api.exportDjp m.token year GotExportDjp
            )

        GotExportDjp (Ok csvContent) ->
            ( { m | uploadStatus = "Export completed!" }
            , downloadCsv { filename = "DJP_Coretax_Export_2026.csv", content = csvContent }
            )

        GotExportDjp (Err _) ->
            ( { m | uploadStatus = "Export failed." }, Cmd.none )



-- VIEW (Placeholder)


view : Model -> Html Msg
view m =
    case m.state of
        Loading ->
            div [] [ text "Loading..." ]

        Failure err ->
            div [] [ text ("Error: " ++ err) ]

        MappingRequired { headers } ->
            Html.map CsvMapperMsg (CsvMapper.view (CsvMapper.init m.token headers))

        Ready data ->
            let
                handlers =
                    { onSourceChange = UpdateSource
                    , onVerify = Verify
                    , onUpload = RequestCsvUpload
                    , onNpwpChange = UpdateNpwp
                    , onNikChange = UpdateNik
                    , onAddressChange = UpdateAddress
                    , onKluCodeChange = UpdateKluCode
                    , onSaveProfile = SaveTaxProfile
                    , onExport = Export 2026
                    }
            in
            D.view
                (Ready data)
                (m.kmk |> Maybe.andThen String.toInt |> Maybe.withDefault 0)
                m.source
                m.uploadStatus
                m.taxProfile
                m.complianceStatus
                handlers



-- MAIN


main : Program { token : String } Model Msg
main =
    Browser.element
        { init =
            \flags ->
                ( { state = Loading
                  , compliance = defaultCompliance
                  , complianceStatus = Nothing
                  , t = epoch
                  , kmk = Nothing
                  , token = flags.token
                  , source = "wise"
                  , uploadStatus = ""
                  , taxProfile = TaxProfile.empty
                  }
                , Cmd.batch
                    [ Api.fetchUnrealized flags.token GotUnrealized
                    , Api.fetchFxEfficiency flags.token GotFxEfficiency
                    , Api.fetchTaxProfile flags.token GotTaxProfile
                    , Api.fetchComplianceStatus flags.token GotComplianceStatus
                    ]
                )
        , update = update
        , view = view
        , subscriptions =
            \_ ->
                Sub.batch
                    [ csvSelected FileSelected
                    , uploadCompleted FileUploadCompleted
                    ]
        }
