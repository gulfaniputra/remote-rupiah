module TransactionDecoderTest exposing (..)

import Data.Transaction as Transaction
import Expect
import Json.Decode as JD
import Test exposing (..)


validJson : String
validJson =
    """
    {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "date": "2026-05-18",
        "currency": "USD",
        "amount_cents": "5420000",
        "withholding_cents": "542000",
        "actual_idr_received_cents": null,
        "kmk_rate": "16120.00",
        "is_1042s_verified": false
    }
    """


suite : Test
suite =
    describe "Transaction.decoder"
        [ test "decodes valid stringified BigInt payload" <|
            \_ ->
                JD.decodeString Transaction.decoder validJson
                    |> Result.toMaybe
                    |> Expect.notEqual Nothing
        , test "rejects float number for amount_cents (Zero-Float Protocol)" <|
            \_ ->
                let
                    floatJson =
                        """
                        {
                            "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                            "date": "2026-05-18",
                            "currency": "USD",
                            "amount_cents": 1250.50,
                            "withholding_cents": "0",
                            "actual_idr_received_cents": null,
                            "kmk_rate": null,
                            "is_1042s_verified": false
                        }
                        """
                in
                JD.decodeString Transaction.decoder floatJson
                    |> Result.toMaybe
                    |> Expect.equal Nothing
        , test "rejects integer number for withholding_cents" <|
            \_ ->
                let
                    intJson =
                        """
                        {
                            "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                            "date": "2026-05-18",
                            "currency": "USD",
                            "amount_cents": "100000",
                            "withholding_cents": 10000,
                            "actual_idr_received_cents": null,
                            "kmk_rate": null,
                            "is_1042s_verified": false
                        }
                        """
                in
                JD.decodeString Transaction.decoder intJson
                    |> Result.toMaybe
                    |> Expect.equal Nothing
        , test "decodes list payload via listDecoder" <|
            \_ ->
                let
                    listJson =
                        """{"transactions": [""" ++ validJson ++ """]}"""
                in
                JD.decodeString Transaction.listDecoder listJson
                    |> Result.toMaybe
                    |> Expect.notEqual Nothing
        ]
