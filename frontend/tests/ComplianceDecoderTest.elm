module ComplianceDecoderTest exposing (..)

import Data.Compliance as C
import Expect
import Json.Decode as JD
import Test exposing (..)


suite : Test
suite =
    describe "Data.Compliance decoder"
        [ describe "W8BenStatus"
            [ test "decodes 'Valid'" <|
                \_ ->
                    JD.decodeString C.w8BenStatusDecoder "\"Valid\""
                        |> Expect.equal (Ok C.W8BenValid)
            , test "decodes 'Expired'" <|
                \_ ->
                    JD.decodeString C.w8BenStatusDecoder "\"Expired\""
                        |> Expect.equal (Ok C.W8BenExpired)
            , test "decodes 'Missing'" <|
                \_ ->
                    JD.decodeString C.w8BenStatusDecoder "\"Missing\""
                        |> Expect.equal (Ok C.W8BenMissing)
            , test "rejects unknown status" <|
                \_ ->
                    JD.decodeString C.w8BenStatusDecoder "\"Unknown\""
                        |> Result.toMaybe
                        |> Expect.equal Nothing
            ]
        , describe "ComplianceStatusResponse decoder"
            [ test "decodes full valid payload" <|
                \_ ->
                    let
                        json =
                            """{"w8benStatus":"Valid","w8benExpiryDate":"2099-12-31","documents":[],"nppnStatus":{"notified":false,"notifiedAt":null,"deadline":"2026-03-31","daysRemaining":30,"isOverdue":false}}"""
                    in
                    JD.decodeString C.complianceStatusDecoder json
                        |> Result.map .w8benStatus
                        |> Expect.equal (Ok C.W8BenValid)
            , test "decodes null w8benExpiryDate" <|
                \_ ->
                    let
                        json =
                            """{"w8benStatus":"Missing","w8benExpiryDate":null,"documents":[],"nppnStatus":{"notified":false,"notifiedAt":null,"deadline":"2026-03-31","daysRemaining":30,"isOverdue":false}}"""
                    in
                    JD.decodeString C.complianceStatusDecoder json
                        |> Result.map .w8benExpiryDate
                        |> Expect.equal (Ok Nothing)
            , test "decodes non-empty documents list" <|
                \_ ->
                    let
                        json =
                            """{"w8benStatus":"Valid","w8benExpiryDate":"2099-01-01","documents":[{"documentType":"1042s","taxYear":2025,"isVerified":true}],"nppnStatus":{"notified":false,"notifiedAt":null,"deadline":"2026-03-31","daysRemaining":30,"isOverdue":false}}"""
                    in
                    JD.decodeString C.complianceStatusDecoder json
                        |> Result.map (.documents >> List.length)
                        |> Expect.equal (Ok 1)
            , test "schema resilience: extra fields are ignored" <|
                \_ ->
                    let
                        json =
                            """{"w8benStatus":"Expired","w8benExpiryDate":"2020-01-01","documents":[],"nppnStatus":{"notified":false,"notifiedAt":null,"deadline":"2026-03-31","daysRemaining":30,"isOverdue":false},"futureField":"ignored"}"""
                    in
                    JD.decodeString C.complianceStatusDecoder json
                        |> Result.map .w8benStatus
                        |> Expect.equal (Ok C.W8BenExpired)
            ]
        , describe "NppnStatus decoder"
            [ test "Full JSON payload with nppnStatus field decodes successfully" <|
                \_ ->
                    let
                        json =
                            """{"w8benStatus":"Valid","w8benExpiryDate":"2099-12-31","documents":[],"nppnStatus":{"notified":true,"notifiedAt":"2026-03-15T10:00:00Z","deadline":"2026-03-31","daysRemaining":0,"isOverdue":false}}"""
                    in
                    JD.decodeString C.complianceStatusDecoder json
                        |> Result.map .nppnStatus
                        |> Result.map .notified
                        |> Expect.equal (Ok True)
            , test "Missing nppnStatus field → decoder fails" <|
                \_ ->
                    let
                        json =
                            """{"w8benStatus":"Valid","w8benExpiryDate":"2099-12-31","documents":[]}"""
                    in
                    JD.decodeString C.complianceStatusDecoder json
                        |> Result.map .nppnStatus
                        |> Result.toMaybe
                        |> Expect.equal Nothing
            ]
        ]
