module ComplianceTest exposing (..)

import Main as Compliance
import Expect
import Test exposing (..)
import Time

suite : Test
suite =
    describe "Compliance Watchdog"
        [ test "March 31, 2026 is Urgent" <|
            \_ ->
                Compliance.isDeadlineUrgent (Time.millisToPosix 1774915200000) Time.utc
                    |> Expect.equal True
        ]

-- Since Main.elm doesn't expose isDeadlineUrgent yet, I should add it or inline the test logic.
-- Actually, let's just make sure Main.elm exposes it.
