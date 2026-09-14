module Data.FxEfficiency exposing
    ( FxEfficiencyData
    , ProviderComparison
    , computeProviderComparisons
    , decoder
    , listDecoder
    )

import Dict exposing (Dict)
import Json.Decode as JD
import Money exposing (IDR, Money, USD)


type alias FxEfficiencyData =
    { date : String
    , amountCents : Money USD
    , amountIdrCents : Money IDR
    , kmkRate : Maybe String
    , actualIdrCents : Maybe (Money IDR)
    , spreadCents : Money IDR
    , source : Maybe String
    }


decoder : JD.Decoder FxEfficiencyData
decoder =
    JD.map6
        (\date amountCents kmkRate actualIdrCents spreadCents source ->
            let
                -- Safely compute pristine amountIdrCents by combining the components we know parsed successfully
                amountIdrCents =
                    case actualIdrCents of
                        Just actual ->
                            Money.add spreadCents actual

                        Nothing ->
                            spreadCents
            in
            FxEfficiencyData date amountCents amountIdrCents kmkRate actualIdrCents spreadCents source
        )
        (JD.field "date" JD.string)
        (JD.field "amount_cents" Money.decoder)
        (JD.field "kmk_rate" (JD.nullable JD.string))
        (JD.field "actual_idr_cents" (JD.nullable Money.decoder))
        (JD.field "spread_cents" Money.decoder)
        (JD.field "source" (JD.nullable JD.string))


listDecoder : JD.Decoder (List FxEfficiencyData)
listDecoder =
    JD.field "fxData" (JD.list decoder)


type alias ProviderComparison =
    { source : String
    , totalLeakage : Money IDR
    , avgSpreadPercent : Float
    , txCount : Int
    }


computeProviderComparisons : List FxEfficiencyData -> List ProviderComparison
computeProviderComparisons fxList =
    fxList
        |> List.foldl groupBySource Dict.empty
        |> Dict.toList
        |> List.map toProviderComparison
        |> List.sortBy (.totalLeakage >> Money.toCents >> negate)


groupBySource : FxEfficiencyData -> Dict String (List FxEfficiencyData) -> Dict String (List FxEfficiencyData)
groupBySource fx dict =
    let
        source =
            fx.source |> Maybe.withDefault "unknown"

        current =
            Dict.get source dict |> Maybe.withDefault []

        updated =
            fx :: current
    in
    Dict.insert source updated dict


toProviderComparison : ( String, List FxEfficiencyData ) -> ProviderComparison
toProviderComparison ( source, records ) =
    { source = source
    , totalLeakage = totalLeakage records
    , avgSpreadPercent = avgSpreadPercent records
    , txCount = List.length records
    }


totalLeakage : List FxEfficiencyData -> Money IDR
totalLeakage =
    List.foldl (\r acc -> Money.add acc r.spreadCents) Money.zero


avgSpreadPercent : List FxEfficiencyData -> Float
avgSpreadPercent records =
    let
        totalSpread =
            records
                |> List.foldl (\r acc -> acc + Money.toCents r.spreadCents) 0

        totalAmountIdr =
            records
                |> List.foldl (\r acc -> acc + Money.toCents r.amountIdrCents) 0
    in
    if totalAmountIdr > 0 then
        toFloat totalSpread / toFloat totalAmountIdr * 100.0

    else
        0.0
