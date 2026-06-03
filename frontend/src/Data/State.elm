module Data.State exposing (State(..))

import Data.FxEfficiency exposing (FxEfficiencyData)
import Data.Transaction exposing (Transaction)
import Data.Unrealized exposing (Unrealized)


type State
    = Loading
    | Failure String
    | MappingRequired { headers : List String }
    | Ready { txs : List Transaction, unrealized : List Unrealized, fxLeakage : List FxEfficiencyData }
