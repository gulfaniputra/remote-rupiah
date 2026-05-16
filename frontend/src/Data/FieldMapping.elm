module Data.FieldMapping exposing (..)

import Json.Decode as JD
import Json.Encode as JE

type Method
    = Exact
    | Normalized
    | Fuzzy
    | None

type alias FieldMatch =
    { source : String
    , target : Maybe String
    , confidence : Float
    , method : Method
    }

type State
    = Loading
    | Failure String
    | Ready
        { matches : List FieldMatch
        , dirty : Bool
        , saving : Bool
        }

-- DECODERS

methodDecoder : JD.Decoder Method
methodDecoder =
    JD.string
        |> JD.andThen
            (\s ->
                case s of
                    "exact" -> JD.succeed Exact
                    "normalized" -> JD.succeed Normalized
                    "fuzzy" -> JD.succeed Fuzzy
                    "none" -> JD.succeed None
                    _ -> JD.fail ("Unknown method: " ++ s)
            )

matchDecoder : JD.Decoder FieldMatch
matchDecoder =
    JD.map4 FieldMatch
        (JD.field "source" JD.string)
        (JD.field "target" (JD.nullable JD.string))
        (JD.field "confidence" JD.float)
        (JD.field "method" methodDecoder)

matchesDecoder : JD.Decoder (List FieldMatch)
matchesDecoder =
    JD.list matchDecoder

-- ENCODERS

encodeMatch : FieldMatch -> JE.Value
encodeMatch match =
    JE.object
        [ ("source", JE.string match.source)
        , ("target", match.target |> Maybe.map JE.string |> Maybe.withDefault JE.null)
        , ("confidence", JE.float match.confidence)
        , ("userVerified", JE.bool True) -- When saving from UI, it's considered verified
        ]

encodeConfirmRequest : List FieldMatch -> JE.Value
encodeConfirmRequest matches =
    JE.object
        [ ("mappings", JE.list encodeMatch (List.filter (\m -> m.target /= Nothing) matches))
        ]

-- HELPERS

getAutoSelect : FieldMatch -> Maybe String
getAutoSelect { confidence, target } =
    if confidence > 0.9 then target else Nothing

shouldWarn : FieldMatch -> Bool
shouldWarn { confidence } =
    confidence >= 0.7 && confidence <= 0.9

requiresManual : FieldMatch -> Bool
requiresManual { confidence, method } =
    confidence < 0.7 || method == None
