module View.Charts exposing (..)

import Money exposing (Money)

toLossyFloat : Money c -> Float
toLossyFloat =
    Money.toAuthoritativeString >> String.toFloat >> Maybe.withDefault 0.0
