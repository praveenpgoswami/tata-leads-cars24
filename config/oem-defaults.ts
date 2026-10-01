/**
 * Fixed OEM payload values and endpoint path.
 *
 * Exports: `OEM_LEAD_PATH`, `DEFAULT_AREA_ID`, `OEM_FIXED_FIELDS`.
 *
 * Notes: Source is docs/Adtrafix - lead contract tata api doc.docx. The doc says "The
 * rest of the fields remain the same", so every non-mandatory field is sent exactly as
 * in its curl sample, including the sample userAgent string (confirmed by the business
 * owner).
 */

/** Path from the doc's curl URL; the base URL comes from env per mode. */
export const OEM_LEAD_PATH = "/api/v1/consumer/leads/third-party-leads";

/** "In case City doesn't have an area then pass the default area id that is 2." */
export const DEFAULT_AREA_ID = 2;

/** Non-mandatory fields, verbatim from the doc's sample payload. */
export const OEM_FIXED_FIELDS = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0",
  whatsappOptIn: false,
  trafficType: "PARTNERSHIP",
  sourceUrl: null,
  leadSource: "adtrafix",
  utmCampaign: null,
  utmMedium: null,
  utmAdGroup: null,
  leadIntent: "PRIMARY",
  gclid: null,
  customerLatitude: null,
  customerLongitude: null,
  interestedInFinance: false,
  productType: "NEW_CARS",
} as const;
