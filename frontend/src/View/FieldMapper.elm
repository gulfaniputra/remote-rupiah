module View.FieldMapper exposing (view)

import Data.FieldMapping as FM
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onInput, onClick)
import Svg exposing (svg, path)
import Svg.Attributes as SA

type alias Config msg =
    { state : FM.State
    , targetOptions : List String
    , onUpdateTarget : String -> String -> msg
    , onSave : msg
    }

view : Config msg -> Html msg
view config =
    div [ class "mapper-card" ]
        [ div [ class "mapper-header" ]
            [ h2 [] [ text "CSV Field Mapping" ]
            , span [ class "text-secondary text-sm" ] [ text "Map incoming CSV headers to internal schema" ]
            ]
        , case config.state of
            FM.Loading ->
                div [ class "flex items-center justify-center p-8" ] [ text "Analyzing fields..." ]

            FM.Failure err ->
                div [ class "flex flex-col items-center gap-4 p-8 text-red" ]
                    [ text ("Error: " ++ err)
                    , button [ class "btn btn-outline", onClick config.onSave ] [ text "Retry" ]
                    ]

            FM.Ready { matches, dirty, saving } ->
                div []
                    [ div [ class "mapper-grid" ] (List.map (viewRow config.targetOptions config.onUpdateTarget) matches)
                    , div [ class "mapper-footer" ]
                        [ button 
                            [ class "btn btn-primary"
                            , disabled (not dirty || saving)
                            , onClick config.onSave
                            ] 
                            [ text (if saving then "Saving..." else "Confirm Mappings") ]
                        ]
                    ]
        ]

viewRow : List String -> (String -> String -> msg) -> FM.FieldMatch -> Html msg
viewRow targets onUpdate match =
    div [ class "mapper-row" ]
        [ div [ class "mapper-source" ] [ text match.source ]
        , div [ class "mapper-arrow" ] 
            [ svg [ SA.width "16", SA.height "16", SA.viewBox "0 0 24 24", SA.fill "none", SA.stroke "currentColor", SA.strokeWidth "2" ] 
                [ path [ SA.d "M5 12h14M12 5l7 7-7 7" ] [] ] 
            ]
        , div [ class "mapper-target" ]
            [ select [ onInput (onUpdate match.source) ]
                (option [ value "", selected (match.target == Nothing) ] [ text "-- Select Target Field --" ]
                    :: List.map (\t -> option [ value t, selected (match.target == Just t) ] [ text t ]) targets
                )
            ]
        , div 
            [ class <| "mapper-confidence " ++ if match.confidence > 0.9 then "conf-high" else if match.confidence >= 0.7 then "conf-med" else "conf-low" ] 
            [ text <| String.fromInt (round (match.confidence * 100)) ++ "% Match" ]
        ]
