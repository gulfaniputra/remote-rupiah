module Money exposing (Money, add, divide, fromCents, fromStr, multiply, proportion, subtract, toCents, zero)

{-| Opaque Money type. Int = cents. Never Float. -}


type Money
    = Money Int


fromCents : Int -> Money
fromCents = Money

toCents : Money -> Int
toCents (Money c) = c

zero : Money
zero = Money 0

add : Money -> Money -> Money
add (Money a) (Money b) = Money (a + b)

subtract : Money -> Money -> Money
subtract (Money a) (Money b) = Money (a - b)

multiply : Money -> Int -> Money
multiply (Money a) n = Money (a * n)

divide : Money -> Int -> Money
divide (Money a) n = if n == 0 then zero else Money (floor (toFloat a / toFloat n))

proportion : Money -> Money -> Money -> Money
proportion (Money base) (Money num) (Money den) =
    if den == 0 then zero else Money (floor (toFloat base * toFloat num / toFloat den))

fromStr : String -> Result String Money
fromStr raw =
    let s = String.trim raw in
    if String.isEmpty s then Err "Empty string"
    else if String.startsWith "-" s then Err "Negative values not allowed"
    else if String.contains " " s then Err "Unexpected space in amount"
    else case String.split "." (String.replace "," "" s) of
        [ i, f ] -> toCentsResult (if String.isEmpty i then "0" else i) f
        [ i ] -> toCentsResult i ""
        _ -> Err "Multiple decimal points"

toCentsResult : String -> String -> Result String Money
toCentsResult i f =
    let
        pad = if String.isEmpty f then "00" else if String.length f == 1 then f ++ "0" else if String.length f == 2 then f else ""
        ok s = not (String.isEmpty s) && String.all Char.isDigit s
    in
    if String.isEmpty pad then Err "More than 2 decimal digits"
    else if not (ok i) then Err ("Invalid integer part: \"" ++ i ++ "\"")
    else if not (ok pad) then Err ("Invalid fractional part: \"" ++ pad ++ "\"")
    else case ( String.toInt i, String.toInt pad ) of
        ( Just d, Just c ) -> Ok (Money (d * 100 + c))
        _ -> Err "Parse error"
