module FileNode exposing
    ( Document
    , FileNode
    , document
    , fileNode
    , render
    , renderDocument
    )

-- FILE NODE


type FileNode
    = FileNode
        { path : String
        , content : String
        }


fileNode : { path : String, content : String } -> FileNode
fileNode input =
    FileNode input


render : FileNode -> String
render (FileNode input) =
    "<file path=\""
        ++ escapeAttr input.path
        ++ "\"><![CDATA["
        ++ escapeCdata input.content
        ++ "]]></file>"



-- DOCUMENT


type Document
    = Document (List FileNode)


document : List FileNode -> Document
document nodes =
    Document nodes


renderDocument : Document -> String
renderDocument (Document nodes) =
    "<files>"
        ++ String.concat (List.map render nodes)
        ++ "</files>"



-- INTERNAL HELPERS


escapeAttr : String -> String
escapeAttr str =
    str
        |> String.replace "&" "&amp;"
        |> String.replace "\"" "&quot;"
        |> String.replace "<" "&lt;"
        |> String.replace ">" "&gt;"


escapeCdata : String -> String
escapeCdata content =
    content
        |> String.split "]]>"
        |> String.join "]]]]><![CDATA[>"
