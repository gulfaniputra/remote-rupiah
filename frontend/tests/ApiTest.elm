module ApiTest exposing (suite)

import Data.FxEfficiency as FxEfficiency
import Data.Unrealized as Unrealized
import Expect
import Json.Decode as JD
import Test exposing (Test, describe, test)


suite : Test
suite =
    describe "Api.fetchUnrealized"
        [ test "decodes positions list payload" <|
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
        , test "rejects payload without positions field" <|
            \_ ->
                JD.decodeString Unrealized.listDecoder
                    """
                    {
                        "total_unrealized_idr_cents": "100000000"
                    }
                    """
                    |> Result.toMaybe
                    |> Expect.equal Nothing
        , test "rejects invalid unrealized money payload" <|
            \_ ->
                JD.decodeString Unrealized.listDecoder
                    """
                    {
                        "positions": [
                            {
                                "source": "wise",
                                "unrealized_idr_cents": "invalid"
                            }
                        ]
                    }
                    """
                    |> Result.toMaybe
                    |> Expect.equal Nothing
        , test "decodes fx efficiency payload" <|
            \_ ->
                JD.decodeString FxEfficiency.listDecoder
                    """
                    {
                        "fxData": [
                            {
                                "date": "2026-05-18",
                                "amount_cents": "100000",
                                "kmk_rate": "16120.00",
                                "actual_idr_cents": "1610000000",
                                "spread_cents": "5000000",
                                "source": "wise"
                            }
                        ]
                    }
                    """
                    |> Result.toMaybe
                    |> Expect.notEqual Nothing
        , test "rejects invalid fx efficiency money payload" <|
            \_ ->
                JD.decodeString FxEfficiency.listDecoder
                    """
                    {
                        "fxData": [
                            {
                                "date": "2026-05-18",
                                "amount_cents": "100000",
                                "kmk_rate": "16120.00",
                                "actual_idr_cents": "1610000000",
                                "spread_cents": "invalid",
                                "source": "wise"
                            }
                        ]
                    }
                    """
                    |> Result.toMaybe
                    |> Expect.equal Nothing
        ]
