module TaxProfileBindingTest exposing (suite)

import Data.TaxProfile as TaxProfile
import Expect
import Json.Decode as JD
import Test exposing (Test, describe, test)


suite : Test
suite =
    describe "Data.TaxProfile"
        [ test "decodes valid tax profile json" <|
            \_ ->
                let
                    json =
                        """
                        {
                            "npwp": "12.345.678.9-012.000",
                            "nik": "1234567890123456",
                            "address": "123 Sudirman, Jakarta",
                            "klu_code": "62010"
                        }
                        """
                in
                JD.decodeString TaxProfile.decoder json
                    |> Result.toMaybe
                    |> Expect.notEqual Nothing
        , test "decodes klu_code from int or string" <|
            \_ ->
                let
                    json =
                        """
                        {
                            "npwp": "12.345.678.9-012.000",
                            "nik": "1234567890123456",
                            "address": "123 Sudirman, Jakarta",
                            "klu_code": 62010
                        }
                        """
                in
                JD.decodeString TaxProfile.decoder json
                    |> Result.toMaybe
                    |> Maybe.map .kluCode
                    |> Expect.equal (Just "62010")
        ]
