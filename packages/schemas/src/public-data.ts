/**
 * Schemas for official public-source data (CDC, openFDA).
 *
 * Everything here is PUBLIC government information. These schemas validate
 * what our source adapters extract so that a page-structure change fails
 * loudly instead of rendering garbage.
 */
import { z } from "zod";

export const OutbreakSnapshot = z.object({
  /** which adapter produced this */
  source: z.enum(["cdc-page", "cdc-content-services", "cached-snapshot"]),
  sourceUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  /** sha256 of the raw fetched content */
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  parserVersion: z.string(),
  outbreak: z.object({
    title: z.string(),
    pathogen: z.string(),
    /** e.g. "1,644" reported as number */
    cases: z.number().int().nonnegative(),
    hospitalizations: z.number().int().nonnegative(),
    deaths: z.number().int().nonnegative(),
    states: z.array(z.string()),
    investigationStatus: z.string(),
    /** CDC page "last updated" or equivalent, as printed */
    officialLastUpdated: z.string(),
    implicatedFood: z.string(),
  }),
});
export type OutbreakSnapshot = z.infer<typeof OutbreakSnapshot>;

export const FdaEnforcementRecord = z.object({
  recall_number: z.string(),
  status: z.string(),
  classification: z.string(),
  product_description: z.string(),
  reason_for_recall: z.string(),
  recalling_firm: z.string(),
  distribution_pattern: z.string().optional(),
  recall_initiation_date: z.string(),
  state: z.string().optional(),
});
export type FdaEnforcementRecord = z.infer<typeof FdaEnforcementRecord>;

export const FdaEnforcementResponse = z.object({
  meta: z.object({
    disclaimer: z.string().optional(),
    results: z
      .object({ skip: z.number(), limit: z.number(), total: z.number() })
      .optional(),
  }),
  results: z.array(FdaEnforcementRecord),
});
export type FdaEnforcementResponse = z.infer<typeof FdaEnforcementResponse>;
