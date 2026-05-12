module DJPCsvExporter exposing (..)
import Money exposing (Money, IDR)
import TaxLogic
calculateNetIncome = TaxLogic.calculateNppn
calculateTax = TaxLogic.calculateIndoTax
