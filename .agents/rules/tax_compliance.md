---
trigger: always_on
---

# Rule: Indo-US Tax Compliance

- **KMK Rates:** Use the weekly KMK rate for the date of receipt.
- **PPh 24:** Implement the "Lesser of" rule and the credit cap formula: (ForeignNet/TotalTaxable) \* TotalIDRTax.
- **NPPN:** Default software developer norma is 50%.
- **Evidence:** Require a `1042s_verified` boolean for all US income transactions.
