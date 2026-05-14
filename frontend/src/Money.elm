module Money exposing (..)

import BigInt exposing (BigInt)
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode



type Money c
    = Money BigInt


type IDR
    = IDR


type USD
    = USD


pInt s =
    if s == "" then
        Nothing

    else
        s
            |> String.toList
            |> List.foldl
                (\c acc ->
                    acc
                        |> Maybe.andThen
                            (\v ->
                                let
                                    d =
                                        Char.toCode c - 48
                                in
                                if d >= 0 && d <= 9 then
                                    Just (BigInt.add (BigInt.mul v (BigInt.fromInt 10)) (BigInt.fromInt d))

                                else
                                    Nothing
                            )
                )
                (Just (BigInt.fromInt 0))


fromCents i =
    Money (BigInt.fromInt i)


fromCentsStr s =
    pInt s |> Maybe.withDefault (BigInt.fromInt 0) |> Money


fromBigInt =
    Money


toBigInt (Money b) =
    b


{-| @deprecated - Use toAuthoritativeString instead -}
toCents : Money c -> Int
toCents =
    toAuthoritativeString >> String.toInt >> Maybe.withDefault 0

toAuthoritativeString : Money c -> String
toAuthoritativeString (Money b) =
    BigInt.toString b

encode : Money c -> Encode.Value
encode =
    toAuthoritativeString >> Encode.string

decoder : Decoder (Money c)
decoder =
    Decode.string
        |> Decode.andThen (pInt >> Maybe.map (Money >> Decode.succeed) >> Maybe.withDefault (Decode.fail "Invalid BigInt format"))


toString (Money b) =
    let
        s =
            BigInt.toString b

        n =
            String.startsWith "-" s

        a =
            if n then
                String.dropLeft 1 s

            else
                s

        l =
            String.length a
    in
    (if n then
        "-"

     else
        ""
    )
        ++ (if l <= 2 then
                "0." ++ String.padLeft 2 '0' a

            else
                String.dropRight 2 a ++ "." ++ String.right 2 a
           )


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


fromStr r =
    let
        s =
            String.replace "," "" (String.trim r)
    in
    if s == "" || String.startsWith "-" s then
        Err "Err"

    else
        case String.split "." s of
            [ i, f ] ->
                if String.length f > 2 then
                    Err "Err"

                else
                    pInt
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
                pInt (i ++ "00") |> Maybe.map Money |> Result.fromMaybe "Err"

            _ ->
                Err "Err"


toDjpString (Money b) =
    let
        s =
            BigInt.toString b

        l =
            String.length s
    in
    if l <= 2 then
        "0," ++ String.padLeft 2 '0' s

    else
        String.dropRight 2 s ++ "," ++ String.right 2 s
