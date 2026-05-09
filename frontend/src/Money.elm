module Money exposing (IDR, Money, USD, add, compare, divide, divideRoundUp, fromBigInt, fromCents, fromStr, fromCentsStr, multiply, proportion, subtract, toBigInt, toCents, toString, toDjpString, zero)
import BigInt exposing (BigInt)

type Money c = Money BigInt
type IDR = IDR
type USD = USD

pInt s = if s == "" then Nothing else s |> String.toList |> List.foldl (\c acc -> acc |> Maybe.andThen (\v -> let d = Char.toCode c - 48 in if d >= 0 && d <= 9 then Just (BigInt.add (BigInt.mul v (BigInt.fromInt 10)) (BigInt.fromInt d)) else Nothing)) (Just (BigInt.fromInt 0))
fromCents i = Money (BigInt.fromInt i)
fromCentsStr s = pInt s |> Maybe.withDefault (BigInt.fromInt 0) |> Money
fromBigInt = Money
toBigInt (Money b) = b
toCents (Money b) = BigInt.toString b |> String.toInt |> Maybe.withDefault 0
toString (Money b) = let s = BigInt.toString b in if String.length s <= 2 then "0." ++ String.padLeft 2 '0' s else String.dropRight 2 s ++ "." ++ String.right 2 s
zero = Money (BigInt.fromInt 0)
add (Money a) (Money b) = Money (BigInt.add a b)
subtract (Money a) (Money b) = Money (BigInt.sub a b)
multiply (Money a) n = Money (BigInt.mul a (BigInt.fromInt n))
divide (Money a) n = if n == 0 then zero else Money (BigInt.div a (BigInt.fromInt n))
divideRoundUp (Money a) n = if n == 0 then zero else Money (BigInt.div (BigInt.add a (BigInt.fromInt (n - 1))) (BigInt.fromInt n))
proportion (Money b) (Money n) (Money d) = if d == BigInt.fromInt 0 then zero else Money (BigInt.div (BigInt.mul b n) d)
compare (Money a) (Money b) = BigInt.compare a b
fromStr raw = let s = String.replace "," "" (String.trim raw) in if s == "" || String.startsWith "-" s then Err "Err" else case String.split "." s of
    [i, f] -> if String.length f > 2 then Err "Err" else pInt ((if i == "" then "0" else i) ++ String.padRight 2 '0' f) |> Maybe.map Money |> Result.fromMaybe "Err"
    [i] -> pInt (i ++ "00") |> Maybe.map Money |> Result.fromMaybe "Err"
    _ -> Err "Err"
toDjpString (Money b) =
    let
        s = BigInt.toString b
    in
    if String.length s <= 2 then
        "0," ++ String.padLeft 2 '0' s
    else
        String.dropRight 2 s ++ "," ++ String.right 2 s
