module Data.TaxProfile exposing (TaxProfile, decoder, decodeKluCode, encoder, empty)

import Json.Decode as JD
import Json.Encode as JE


type alias TaxProfile =
    { npwp : String
    , nik : String
    , address : String
    , kluCode : String
    }


empty : TaxProfile
empty =
    { npwp = ""
    , nik = ""
    , address = ""
    , kluCode = ""
    }


decoder : JD.Decoder TaxProfile
decoder =
    JD.map4 TaxProfile
        (JD.field "npwp" JD.string)
        (JD.field "nik" JD.string)
        (JD.field "address" JD.string)
        (JD.field "klu_code" decodeKluCode)


decodeKluCode : JD.Decoder String
decodeKluCode =
    JD.oneOf
        [ JD.string
        , JD.int |> JD.map String.fromInt
        ]


encoder : TaxProfile -> JE.Value
encoder profile =
    JE.object
        [ ( "npwp", JE.string profile.npwp )
        , ( "nik", JE.string profile.nik )
        , ( "address", JE.string profile.address )
        , ( "kluCode", JE.string profile.kluCode )
        ]
