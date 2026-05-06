module DJPCsvExporter exposing (calculateTax, calculateNetIncome, calculatePPh24Cap)
import Money exposing (Money, IDR)
import TaxLogic
calculateNetIncome = TaxLogic.calculateNppn
calculateTax = TaxLogic.calculateIndoTax
calculatePPh24Cap p = TaxLogic.calculatePPh24Credit { foreignNetIncome = p.foreignNet, totalTaxableIncome = p.totalNet, totalIndoTaxDue = p.totalIndoTax, actualForeignTaxPaid = p.foreignPaid }
