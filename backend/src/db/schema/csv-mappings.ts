import { z } from "zod";

export const CsvMappingSchema = z.record(
  z.string(),
  z.enum(["date", "amount", "currency"]),
).refine((mapping) => {
  const values = Object.values(mapping);
  return (
    values.includes("date") &&
    values.includes("amount") &&
    values.includes("currency")
  );
}, {
  message:
    "Mapping must contain all required target fields: date, amount, currency",
});

export type CsvMapping = z.infer<typeof CsvMappingSchema>;
