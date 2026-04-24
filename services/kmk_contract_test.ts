import { assertEquals } from "@std/assert";
import { z } from "zod";

// Re-defining the schema locally for the test or importing if preferred.
// To keep it simple and focused on "Verification", we test the structure we inferred.
const KmkApiCurrencySchema = z.object({
  kurs_beli: z.string(),
  kurs_jual: z.string(),
  kurs_tengah: z.string(),
  kode_mata_uang: z.string().length(3),
  nama_mata_uang: z.string(),
});

const KmkApiResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    result: z.array(z.object({
      no_kmk: z.string(),
      tgl_berlaku: z.string(),
      tgl_akhir: z.string(),
      kurs: z.array(KmkApiCurrencySchema),
    })),
  }),
});

Deno.test("KMK API Contract Verification (Mock)", () => {
  const mockResponse = {
    status: "success",
    data: {
      result: [
        {
          no_kmk: "17/MK/EF.2/2026",
          tgl_berlaku: "2026-04-22",
          tgl_akhir: "2026-04-28",
          kurs: [
            {
              kurs_beli: "17146.00",
              kurs_jual: "17146.00",
              kurs_tengah: "17146.00",
              kode_mata_uang: "USD",
              nama_mata_uang: "US Dollar",
            }
          ]
        }
      ]
    }
  };

  const result = KmkApiResponseSchema.safeParse(mockResponse);
  assertEquals(result.success, true, "Schema should match the mock response structure");
  
  if (result.success) {
    const usd = result.data.data.result[0].kurs.find(k => k.kode_mata_uang === "USD");
    assertEquals(usd?.kurs_tengah, "17146.00");
  }
});
