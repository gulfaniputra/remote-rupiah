import { z } from "zod";

export const CsvMappingSchema = z
  .record(
    z.string(),
    z.enum(["date", "amount", "currency", "actual_idr_received_cents"]),
  )
  .refine(
    (mapping) => {
      const values = Object.values(mapping);
      return (
        values.includes("date") &&
        values.includes("amount") &&
        values.includes("currency")
      );
    },
    {
      message:
        "Mapping must contain all required target fields: date, amount, currency",
    },
  );
