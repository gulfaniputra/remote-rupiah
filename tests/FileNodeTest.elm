module FileNodeTest exposing (tests)

import Expect
import FileNode exposing (..)
import Test exposing (..)


tests : Test
tests =
    describe "FileNode"
        [ describe "render"
            [ test "wraps content in CDATA" <|
                \_ ->
                    let
                        input =
                            { path = "example.txt"
                            , content = "1 < 2 & 3 > 1"
                            }
                    in
                    Expect.equal
                        "<file path=\"example.txt\"><![CDATA[1 < 2 & 3 > 1]]></file>"
                        (fileNode input |> render)
            , test "escapes special characters in path attribute" <|
                \_ ->
                    let
                        input =
                            { path = "a\"b&c<d>.txt"
                            , content = "ok"
                            }
                    in
                    Expect.equal
                        "<file path=\"a&quot;b&amp;c&lt;d&gt;.txt\"><![CDATA[ok]]></file>"
                        (fileNode input |> render)
            , test "handles CDATA termination safely" <|
                \_ ->
                    let
                        input =
                            { path = "test.txt"
                            , content = "foo]]>bar"
                            }
                    in
                    Expect.equal
                        "<file path=\"test.txt\"><![CDATA[foo]]]]><![CDATA[>bar]]></file>"
                        (fileNode input |> render)
            ]
        , describe "renderDocument"
            [ test "renders multiple file nodes inside <files>" <|
                \_ ->
                    let
                        doc =
                            document
                                [ fileNode { path = "a.txt", content = "A" }
                                , fileNode { path = "b.txt", content = "B" }
                                ]
                    in
                    Expect.equal
                        "<files><file path=\"a.txt\"><![CDATA[A]]></file><file path=\"b.txt\"><![CDATA[B]]></file></files>"
                        (renderDocument doc)
            ]
        ]