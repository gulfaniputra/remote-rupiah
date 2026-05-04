module Money exposing (IDR, Money, USD, add, divide, fromCents, fromStr, multiply, proportion, subtract, toCents, zero)

{-| Opaque Money type. Int = cents. Never Float.
Phantom type 'c' ensures we don't mix USD and IDR.

SECURITY NOTE: While internal representation is Int, we use toFloat/floor for
intermediate division/proportion to avoid Elm's 32-bit integer truncation (//).
This allows safe handling of values up to 2^53 - 1 cents (approx Rp 90 Trillion).
-}


type Money c
    = Money Int


type IDR
    = IDR


type USD
    = USD


fromCents : Int -> Money c
fromCents =
    Money


toCents : Money c -> Int
toCents (Money c) =
    c


zero : Money c
zero =
    Money 0


add : Money c -> Money c -> Money c
add (Money a) (Money b) =
    Money (a + b)


subtract : Money c -> Money c -> Money c
subtract (Money a) (Money b) =
    Money (a - b)


multiply : Money c -> Int -> Money c
multiply (Money a) n =
    Money (a * n)


divide : Money c -> Int -> Money c
divide (Money a) n =
    if n == 0 then
        zero

    else
        Money (floor (toFloat a / toFloat n))


proportion : Money c -> Money c -> Money c -> Money c
proportion (Money base) (Money num) (Money den) =
    if den == 0 then
        zero

    else
        Money (floor (toFloat base * toFloat num / toFloat den))


fromStr : String -> Result String (Money c)
fromStr raw =
    let
        s =
            String.trim raw
    in
    if String.isEmpty s then
        Err "Empty string"

    else if String.startsWith "-" s then
        Err "Negative values not allowed"

    else if String.contains " " s then
        Err "Unexpected space in amount"

    else
        case String.split "." (String.replace "," "" s) of
            [ i, f ] ->
                toCentsResult (if String.isEmpty i then "0" else i) f

            [ i ] ->
                toCentsResult i ""

            _ ->
                Err "Multiple decimal points"


toCentsResult : String -> String -> Result String (Money c)
toCentsResult i f =
    let
        pad =
            if String.isEmpty f then
                "00"

            else if String.length f == 1 then
                f ++ "0"

            else if String.length f == 2 then
                f

            else
                ""

        ok s =
            not (String.isEmpty s) && String.all Char.isDigit s
    in
    if String.isEmpty pad then
        Err "More than 2 decimal digits"

    else if not (ok i) then
        Err ("Invalid integer part: \"" ++ i ++ "\"")

    else if not (ok pad) then
        Err ("Invalid fractional part: \"" ++ pad ++ "\"")

    else
        case ( String.toInt i, String.toInt pad ) of
            ( Just d, Just c ) ->
                Ok (Money (d * 100 + c))

            _ ->
                Err "Parse error"
