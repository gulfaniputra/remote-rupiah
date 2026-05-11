module View.Dashboard exposing (..)
import Html exposing (..)
import Html.Attributes exposing (..)
import Money
view d = div [ class "cards-grid" ] (List.map (\(l, v, c) -> div [ class ("card " ++ c) ] [ h3 [] [ text l ], div [ class "big-value font-mono" ] [ text ("Rp " ++ Money.toString v) ] ]) [ ("YTD GROSS", d.ytdGross, "card-teal"), ("FX LEAKAGE", d.fxLeakage, "card-default"), ("PROJECTED TAX", d.projectedTax, "card-default") ])
