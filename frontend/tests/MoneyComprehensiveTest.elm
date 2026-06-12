module MoneyComprehensiveTest exposing (suite)

import BigInt
import Expect
import Fuzz
import Json.Decode as Decode
import Json.Encode as Encode
import Money
import Test exposing (..)


suite : Test
suite =
    describe "Money Comprehensive"
        [ describe "Construction"
            [ test "fromCents positive" <|
                \_ -> Money.fromCents 100 |> Money.toBigInt |> BigInt.toString |> Expect.equal "100"
            , test "fromCents zero" <|
                \_ -> Money.fromCents 0 |> Money.toBigInt |> BigInt.toString |> Expect.equal "0"
            , test "fromCentsStr valid" <|
                \_ -> Money.fromCentsStr "100" |> Money.toAuthoritativeString |> Expect.equal "100"
            , test "fromCentsStr malformed falls back to zero" <|
                \_ -> Money.fromCentsStr "not-a-number" |> Money.toAuthoritativeString |> Expect.equal "0"
            , test "fromBigInt identity" <|
                \_ -> BigInt.fromInt 500 |> Money.fromBigInt |> Money.toBigInt |> BigInt.toString |> Expect.equal "500"
            , fuzz (Fuzz.intRange 0 2147483647) "fromCents round-trip via toAuthoritativeString" <|
                \n -> Money.fromCents n |> Money.toAuthoritativeString |> Expect.equal (String.fromInt n)
            ]
        , describe "Arithmetic"
            [ test "add" <|
                \_ -> Money.add (Money.fromCents 100) (Money.fromCents 200) |> Money.toAuthoritativeString |> Expect.equal "300"
            , test "add large: 100B + 1" <|
                \_ -> Money.add (Money.fromCentsStr "10000000000000") (Money.fromCents 1) |> Money.toAuthoritativeString |> Expect.equal "10000000000001"
            , test "subtract" <|
                \_ -> Money.subtract (Money.fromCents 300) (Money.fromCents 100) |> Money.toAuthoritativeString |> Expect.equal "200"
            , test "subtract negative result" <|
                \_ -> Money.subtract (Money.fromCents 100) (Money.fromCents 300) |> Money.toAuthoritativeString |> Expect.equal "-200"
            , test "multiply" <|
                \_ -> Money.multiply (Money.fromCents 100) 3 |> Money.toAuthoritativeString |> Expect.equal "300"
            , test "multiply large keeps full precision" <|
                \_ -> Money.multiply (Money.fromCentsStr "999999999999") 999 |> Money.toAuthoritativeString |> Expect.equal "998999999999001"
            , test "divide" <|
                \_ -> Money.divide (Money.fromCents 300) 3 |> Money.toAuthoritativeString |> Expect.equal "100"
            , test "divide by zero returns zero" <|
                \_ -> Money.divide (Money.fromCents 100) 0 |> Money.toAuthoritativeString |> Expect.equal "0"
            , test "divide truncates toward zero" <|
                \_ -> Money.divide (Money.fromCents 100) 3 |> Money.toAuthoritativeString |> Expect.equal "33"
            , test "divideRoundUp" <|
                \_ -> Money.divideRoundUp (Money.fromCents 100) 3 |> Money.toAuthoritativeString |> Expect.equal "34"
            , test "divideRoundUp exact" <|
                \_ -> Money.divideRoundUp (Money.fromCents 300) 3 |> Money.toAuthoritativeString |> Expect.equal "100"
            , test "divideRoundUp by zero returns zero" <|
                \_ -> Money.divideRoundUp (Money.fromCents 100) 0 |> Money.toAuthoritativeString |> Expect.equal "0"
            , test "proportion: 200 * 100 / 300 rounded down" <|
                \_ -> Money.proportion (Money.fromCents 200) (Money.fromCents 100) (Money.fromCents 300) |> Money.toAuthoritativeString |> Expect.equal "66"
            , test "proportion zero denominator returns zero" <|
                \_ -> Money.proportion (Money.fromCents 200) (Money.fromCents 100) (Money.fromCents 0) |> Money.toAuthoritativeString |> Expect.equal "0"
            , test "proportion precise" <|
                \_ -> Money.proportion (Money.fromCents 600) (Money.fromCents 400) (Money.fromCents 1000) |> Money.toAuthoritativeString |> Expect.equal "240"
            ]
        , describe "Comparison"
            [ test "compare LT" <|
                \_ -> Money.compare (Money.fromCents 100) (Money.fromCents 200) |> Expect.equal LT
            , test "compare EQ" <|
                \_ -> Money.compare (Money.fromCents 100) (Money.fromCents 100) |> Expect.equal EQ
            , test "compare GT" <|
                \_ -> Money.compare (Money.fromCents 300) (Money.fromCents 100) |> Expect.equal GT
            , test "zero equals zero" <|
                \_ -> Money.compare Money.zero Money.zero |> Expect.equal EQ
            ]
        , describe "Formatting"
            [ test "toString standard" <|
                \_ -> Money.fromCents 125055 |> Money.toString |> Expect.equal "1250.55"
            , test "toString zero" <|
                \_ -> Money.fromCents 0 |> Money.toString |> Expect.equal "0.00"
            , test "toString whole number" <|
                \_ -> Money.fromCents 50000 |> Money.toString |> Expect.equal "500.00"
            , test "toString large" <|
                \_ -> Money.fromCentsStr "10000000000000" |> Money.toString |> Expect.equal "100000000000.00"
            , test "toString negative" <|
                \_ -> Money.fromCentsStr "-125050" |> Money.toString |> Expect.equal "-1250.50"
            , test "toDjpString standard" <|
                \_ -> Money.fromCents 125055 |> Money.toDjpString |> Expect.equal "1250,55"
            , test "toDjpString zero" <|
                \_ -> Money.fromCents 0 |> Money.toDjpString |> Expect.equal "0,00"
            , test "toDjpString single digit" <|
                \_ -> Money.fromCents 5 |> Money.toDjpString |> Expect.equal "0,05"
            ]
        , describe "JSON Serialization"
            [ test "encode produces string" <|
                \_ -> Money.fromCents 100 |> Money.encode |> Encode.encode 0 |> Expect.equal "\"100\""
            , test "encode large value" <|
                \_ -> Money.fromCentsStr "99999999999999" |> Money.encode |> Encode.encode 0 |> Expect.equal "\"99999999999999\""
            , test "decode valid string" <|
                \_ ->
                    case Decode.decodeString Money.decoder "\"500\"" of
                        Ok m ->
                            Money.toAuthoritativeString m |> Expect.equal "500"
                        Err _ ->
                            Expect.fail "Should decode successfully"
            , test "decode invalid string fails" <|
                \_ ->
                    case Decode.decodeString Money.decoder "\"not-a-number\"" of
                        Ok _ ->
                            Expect.fail "Should have failed"
                        Err _ ->
                            Expect.pass
            , test "decode non-string fails" <|
                \_ ->
                    case Decode.decodeString Money.decoder "123" of
                        Ok _ ->
                            Expect.fail "Should have failed"
                        Err _ ->
                            Expect.pass
            ]
        , describe "toCents (deprecated; bounds check)"
            [ test "within 32-bit int range" <|
                \_ -> Money.fromCents 2147483647 |> Money.toCents |> Expect.equal 2147483647
            , test "beyond 32-bit int returns actual value" <|
                \_ -> Money.fromCentsStr "2147483648" |> Money.toCents |> Expect.equal 2147483648
            ]
        , fuzz (Fuzz.intRange 0 999999999) "round-trip: add then subtract identity" <|
            \n ->
                let
                    a =
                        Money.fromCents n

                    b =
                        Money.fromCents n
                in
                Money.subtract (Money.add a b) b |> Money.toAuthoritativeString |> Expect.equal (String.fromInt n)
        , fuzz (Fuzz.intRange 0 999999999) "multiply/divide floor equality" <|
            \n ->
                let
                    m =
                        Money.fromCents n
                in
                Money.divide (Money.multiply m 100) 100 |> Money.toAuthoritativeString |> Expect.equal (String.fromInt n)
        , fuzz (Fuzz.intRange 0 2147483647) "big int safety: all ops produce bigint strings" <|
            \n ->
                let
                    m =
                        Money.fromCents n

                    result =
                        Money.add m (Money.fromCents 1)
                            |> Money.add (Money.fromCentsStr "10000000000000")
                            |> Money.toAuthoritativeString
                in
                Expect.equal True (String.all (\c -> Char.isDigit c || c == '-') result)
        ]