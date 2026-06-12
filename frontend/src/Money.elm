module Money exposing
    ( IDR
    , Money
    , USD
    , add
    , compare
    , decoder
    , divide
    , divideRoundUp
    , encode
    , fromBigInt
    , fromCents
    , fromCentsStr
    , fromStr
    , multiply
    , proportion
    , subtract
    , toAuthoritativeString
    , toBigInt
    , toCents
    , toDjpString
    , toString
    , zero
    )

import BigInt exposing (BigInt)
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode


type Money c
    = Money BigInt


type IDR
    = IDR


type USD
    = USD


fromCents : Int -> Money c
fromCents =
    BigInt.fromInt >> Money


fromCentsStr : String -> Money c
fromCentsStr =
    BigInt.fromIntString >> Maybe.withDefault (BigInt.fromInt 0) >> Money


fromBigInt : BigInt -> Money c
fromBigInt =
    Money


toBigInt : Money c -> BigInt
toBigInt (Money b) =
    b


{-| @deprecated High-value transactions exceed 32-bit bounds. Use toAuthoritativeString.
-}
toCents : Money c -> Int
toCents =
    toAuthoritativeString >> String.toInt >> Maybe.withDefault -1


toAuthoritativeString : Money c -> String
toAuthoritativeString (Money b) =
    BigInt.toString b


encode : Money c -> Encode.Value
encode =
    toAuthoritativeString >> Encode.string


decoder : Decoder (Money c)
decoder =
    Decode.string
        |> Decode.andThen (BigInt.fromIntString >> Maybe.map (Money >> Decode.succeed) >> Maybe.withDefault (Decode.fail "Invalid authoritative money string"))


toString : Money c -> String
toString (Money b) =
    let
        raw =
            BigInt.toString b

        unsigned =
            if String.startsWith "-" raw then
                String.dropLeft 1 raw

            else
                raw

        body =
            if String.length unsigned <= 2 then
                "0." ++ String.padLeft 2 '0' unsigned

            else
                String.dropRight 2 unsigned ++ "." ++ String.right 2 unsigned
    in
    (if String.startsWith "-" raw then
        "-"

     else
        ""
    )
        ++ body


zero : Money c
zero =
    Money (BigInt.fromInt 0)


add (Money a) (Money b) =
    Money (BigInt.add a b)


subtract (Money a) (Money b) =
    Money (BigInt.sub a b)


multiply (Money a) n =
    Money (BigInt.mul a (BigInt.fromInt n))


divide (Money a) n =
    if n == 0 then
        zero

    else
        Money (BigInt.div a (BigInt.fromInt n))


divideRoundUp (Money a) n =
    if n == 0 then
        zero

    else
        Money (BigInt.div (BigInt.add a (BigInt.fromInt (n - 1))) (BigInt.fromInt n))


proportion (Money b) (Money n) (Money d) =
    if BigInt.compare d (BigInt.fromInt 0) == EQ then
        zero

    else
        Money (BigInt.div (BigInt.mul b n) d)


compare (Money a) (Money b) =
    BigInt.compare a b


fromStr : String -> Result String (Money c)
fromStr r =
    let
        s =
            r |> String.trim |> String.replace "," ""
    in
    if s == "" || String.startsWith "-" s then
        Err "Err"

    else
        case String.split "." s of
            [ i, f ] ->
                if String.length f > 2 then
                    Err "Err"

                else
                    BigInt.fromIntString
                        ((if i == "" then
                            "0"

                          else
                            i
                         )
                            ++ String.padRight 2 '0' f
                        )
                        |> Maybe.map Money
                        |> Result.fromMaybe "Err"

            [ i ] ->
                BigInt.fromIntString (i ++ "00") |> Maybe.map Money |> Result.fromMaybe "Err"

            _ ->
                Err "Err"


toDjpString : Money c -> String
toDjpString (Money b) =
    let
        s =
            BigInt.toString b
    in
    if String.length s <= 2 then
        "0," ++ String.padLeft 2 '0' s

    else
        String.dropRight 2 s ++ "," ++ String.right 2 s
