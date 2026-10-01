/**
 * Maps a validated lead to the OEM request payload and validates that payload.
 *
 * Exports: `oemLeadPayloadSchema`, `OemLeadPayload`, `buildOemPayload()`.
 *
 * Notes: Field names, types and fixed values follow the curl sample in
 * docs/Adtrafix - lead contract tata api doc.docx. Mandatory fields per the doc:
 * customerName, interestedModelId, customerNumber, interestedMakeId, customerCitySlug,
 * customerAreaId. The schema is strict, so an unexpected field is a bug.
 */
import { z } from "zod";
import { TATA_MAKE_ID, TATA_MODELS } from "@/config/models";
import { OEM_FIXED_FIELDS } from "@/config/oem-defaults";
import type { NormalizedLead } from "@/lib/validation/lead-row";

const MODEL_IDS = new Set(TATA_MODELS.map((model) => model.id));

export const oemLeadPayloadSchema = z.strictObject({
  customerName: z.string().min(1).max(100),
  interestedModelId: z
    .number()
    .int()
    .refine((id) => MODEL_IDS.has(id), "Unknown model ID"),
  customerNumber: z.string().regex(/^[6-9]\d{9}$/),
  interestedMakeId: z.literal(TATA_MAKE_ID),
  userAgent: z.literal(OEM_FIXED_FIELDS.userAgent),
  whatsappOptIn: z.literal(OEM_FIXED_FIELDS.whatsappOptIn),
  trafficType: z.literal(OEM_FIXED_FIELDS.trafficType),
  sourceUrl: z.null(),
  leadSource: z.literal(OEM_FIXED_FIELDS.leadSource),
  utmCampaign: z.null(),
  utmMedium: z.null(),
  utmAdGroup: z.null(),
  leadIntent: z.literal(OEM_FIXED_FIELDS.leadIntent),
  gclid: z.null(),
  customerCitySlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  customerLatitude: z.null(),
  customerLongitude: z.null(),
  interestedInFinance: z.literal(OEM_FIXED_FIELDS.interestedInFinance),
  customerAreaId: z.number().int().positive(),
  productType: z.literal(OEM_FIXED_FIELDS.productType),
  pinCode: z.number().int().min(100000).max(999999),
});

export type OemLeadPayload = z.infer<typeof oemLeadPayloadSchema>;

/**
 * Builds the OEM payload in the same key order as the doc's sample.
 * @param lead a lead returned by `validateLeadCells()` with status "valid".
 */
export function buildOemPayload(lead: NormalizedLead): OemLeadPayload {
  return {
    customerName: lead.customerName,
    interestedModelId: lead.interestedModelId,
    customerNumber: lead.customerNumber,
    interestedMakeId: TATA_MAKE_ID,
    userAgent: OEM_FIXED_FIELDS.userAgent,
    whatsappOptIn: OEM_FIXED_FIELDS.whatsappOptIn,
    trafficType: OEM_FIXED_FIELDS.trafficType,
    sourceUrl: OEM_FIXED_FIELDS.sourceUrl,
    leadSource: OEM_FIXED_FIELDS.leadSource,
    utmCampaign: OEM_FIXED_FIELDS.utmCampaign,
    utmMedium: OEM_FIXED_FIELDS.utmMedium,
    utmAdGroup: OEM_FIXED_FIELDS.utmAdGroup,
    leadIntent: OEM_FIXED_FIELDS.leadIntent,
    gclid: OEM_FIXED_FIELDS.gclid,
    customerCitySlug: lead.customerCitySlug,
    customerLatitude: OEM_FIXED_FIELDS.customerLatitude,
    customerLongitude: OEM_FIXED_FIELDS.customerLongitude,
    interestedInFinance: OEM_FIXED_FIELDS.interestedInFinance,
    customerAreaId: lead.customerAreaId,
    productType: OEM_FIXED_FIELDS.productType,
    pinCode: lead.pinCode,
  };
}
