module Icons exposing (barChart3, shield, zap)

import Html exposing (Html)
import Svg exposing (svg)
import Svg.Attributes exposing (d, fill, height, stroke, strokeLinecap, strokeLinejoin, strokeWidth, viewBox, width)


shield : Html msg
shield =
    svg
        [ width "16"
        , height "16"
        , viewBox "0 0 24 24"
        , fill "none"
        , stroke "currentColor"
        , strokeWidth "2"
        , strokeLinecap "round"
        , strokeLinejoin "round"
        ]
        [ Svg.path [ d "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" ] []
        ]


zap : Html msg
zap =
    svg
        [ width "16"
        , height "16"
        , viewBox "0 0 24 24"
        , fill "none"
        , stroke "currentColor"
        , strokeWidth "2"
        , strokeLinecap "round"
        , strokeLinejoin "round"
        ]
        [ Svg.polygon [ Svg.Attributes.points "13 2 3 14 12 14 11 22 21 10 12 10" ] []
        ]


barChart3 : Html msg
barChart3 =
    svg
        [ width "16"
        , height "16"
        , viewBox "0 0 24 24"
        , fill "none"
        , stroke "currentColor"
        , strokeWidth "2"
        , strokeLinecap "round"
        , strokeLinejoin "round"
        ]
        [ Svg.path [ d "M3 3v18h18" ] []
        , Svg.path [ d "M7 16l4-8 4 4 4-6" ] []
        ]
