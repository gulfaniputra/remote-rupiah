module Data.State exposing (State(..))

import Data.Transaction exposing (Transaction)


type State
    = Loading
    | Failure String
    | Ready { txs : List Transaction }
