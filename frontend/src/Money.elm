module Money exposing
    ( Money
    , add
    , fromCents
    , multiply
    , subtract
    , toCents
    , zero
    )

{-| Opaque type for representing currency.
Never use Float for money. Always wrap an Int representing cents to prevent precision leakage.
-}


type Money
    = Money Int


fromCents : Int -> Money
fromCents cents =
    Money cents


toCents : Money -> Int
toCents (Money cents) =
    cents


zero : Money
zero =
    Money 0


add : Money -> Money -> Money
add (Money a) (Money b) =
    Money (a + b)


subtract : Money -> Money -> Money
subtract (Money a) (Money b) =
    Money (a - b)


multiply : Money -> Int -> Money
multiply (Money a) multiplier =
    Money (a * multiplier)
