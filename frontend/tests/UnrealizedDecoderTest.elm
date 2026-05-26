module UnrealizedDecoderTest exposing (suite)

import Data.Unrealized as Unrealized
import Expect
import Json.Decode as JD
import Test exposing (Test, describe, test)


suite : Test
suite =
    describe "Unrealized.decoder"
        [ test "decodes string-based unrealized payload" <|
            \_ ->
                JD.decodeString Unrealized.decoder
                    """
                    {
                        "source": "wise",
                        "unrealized_idr_cents": "100000000"
                    }
                    """
                    |> Result.toMaybe
                    |> Expect.notEqual Nothing
        , test "decodes positions list payload" <|
            \_ ->
                JD.decodeString Unrealized.listDecoder
                    """
                    {
                        "positions": [
                            {
                                "source": "wise",
                                "unrealized_idr_cents": "100000000"
                            }
                        ]
                    }
                    """
                    |> Result.toMaybe
                    |> Expect.notEqual Nothing
        ]
