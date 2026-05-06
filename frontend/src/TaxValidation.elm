module TaxValidation exposing (ExportError(..), ReadyForExport, validate, Profile)
type ExportError = MissingNPWP | MissingAddress
type ReadyForExport = ReadyForExport Profile
type alias Profile = { npwp : String, nik : String, address : String, kluCode : Int }
validate p = if String.trim p.npwp == "" then Err MissingNPWP else if String.trim p.address == "" then Err MissingAddress else Ok (ReadyForExport p)
