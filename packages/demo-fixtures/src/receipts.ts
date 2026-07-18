/**
 * SYNTHETIC DEMONSTRATION DATA — deterministic consumer receipts for the
 * P1 consumer check. One intersects the affected lineage, one does not.
 */
import type { ConsumerReceipt } from "@recalllens/schemas";
import {
  AFFECTED_LINEAGE_TOKEN,
  CLEAN_LINEAGE_TOKEN,
  LETTUCE_GTIN,
} from "./trace-events";

export const receipts: ConsumerReceipt[] = [
  {
    receiptId: "rcpt-demo-affected-001",
    merchantName: "QuickServe #109 Columbus Junction",
    purchasedAt: "2026-06-24T12:41:00Z",
    items: [
      {
        description: "Crunchy Taco Combo",
        productGtin: LETTUCE_GTIN,
        lineageToken: AFFECTED_LINEAGE_TOKEN,
      },
    ],
    synthetic: true,
  },
  {
    receiptId: "rcpt-demo-clean-002",
    merchantName: "QuickServe #312",
    purchasedAt: "2026-06-26T18:03:00Z",
    items: [
      {
        description: "Bean Burrito",
        productGtin: LETTUCE_GTIN,
        lineageToken: CLEAN_LINEAGE_TOKEN,
      },
    ],
    synthetic: true,
  },
];
