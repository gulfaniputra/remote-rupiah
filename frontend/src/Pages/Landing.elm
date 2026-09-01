module Pages.Landing exposing (view)

import Html exposing (Html, a, button, div, h1, p, span, text)
import Html.Attributes exposing (class, href, rel, target, type_)
import Html.Events exposing (onClick)
import Icons


view : msg -> Html msg
view goToDashboardMsg =
    div [ class "landing-root" ]
        [ -- Glowing orbs
          div [ class "landing-orb-cyan" ] []
        , div [ class "landing-orb-purple" ] []

        -- Main content
        , div [ class "landing-main" ]
            [ -- Badge
              div [ class "landing-badge" ]
                [ text "ELM · DENO · HONO · POSTGRES" ]

            -- Headline
            , h1 [ class "landing-headline" ]
                [ span [ class "landing-headline-cyan" ] [ text "remote" ]
                , span [ class "landing-headline-white" ] [ text "-rupiah" ]
                ]

            -- Sub-headline
            , div [ class "landing-sub" ]
                [ p [ class "landing-sub-text" ]
                    [ text "Tax compliance dashboard for Indonesian Software Developers billing U.S. clients" ]
                , p [ class "landing-sub-muted" ]
                    [ text "NPPN Net Income · PPh 24 Foreign Tax Credit · FX Spread Tracking" ]
                ]

            -- CTA Buttons
            , div [ class "landing-cta-row" ]
                [ button
                    [ class "landing-btn-primary"
                    , type_ "button"
                    , onClick goToDashboardMsg
                    ]
                    [ text "Launch Demo"
                    , span [ class "arrow" ] [ text "→" ]
                    ]
                , a
                    [ class "landing-btn-secondary"
                    , href "https://github.com/gulfaniputra/remote-rupiah"
                    , target "_blank"
                    , rel "noopener noreferrer"
                    ]
                    [ Icons.shield
                    , text "View Source"
                    ]
                ]

            -- Feature grid
            , div [ class "landing-features" ]
                [ div [ class "landing-feature-item" ]
                    [ span [ class "landing-feature-icon-green" ] [ Icons.shield ]
                    , text "Tenant‑Scoped RLS Queries"
                    ]
                , div [ class "landing-feature-item" ]
                    [ span [ class "landing-feature-icon-gold" ] [ Icons.zap ]
                    , text "Edge‑Native Deno API"
                    ]
                , div [ class "landing-feature-item" ]
                    [ span [ class "landing-feature-icon-cyan" ] [ Icons.barChart3 ]
                    , text "BigInt Money Arithmetic"
                    ]
                ]
            ]
        ]
