export interface CanonicalTx {
  date: Date;
  amount: bigint;
  currency: string;
  actualIdrReceivedCents?: bigint | null;
}
