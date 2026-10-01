/**
 * Tests for Excel row → OEM payload mapping (lib/oem/payload.ts), checked against the
 * curl sample in docs/Adtrafix - lead contract tata api doc.docx.
 */
import { describe, expect, it } from "vitest";
import { buildOemPayload, oemLeadPayloadSchema } from "@/lib/oem/payload";
import { validateLeadCells } from "@/lib/validation/lead-row";

/** The doc's sample body, with the lead-specific values replaced by our row's. */
const DOC_SAMPLE_SHAPE = {
  customerName: "Rama",
  interestedModelId: 1188,
  customerNumber: "8823098494",
  interestedMakeId: 69,
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
  customerCitySlug: "new-delhi",
  customerLatitude: null,
  customerLongitude: null,
  interestedInFinance: false,
  customerAreaId: 2,
  productType: "NEW_CARS",
  pinCode: 110003,
};

function leadFrom(cells: Parameters<typeof validateLeadCells>[0]) {
  const result = validateLeadCells(cells);
  if (!result.lead) {
    throw new Error(`expected a valid lead, got ${result.status}`);
  }
  return result.lead;
}

describe("buildOemPayload", () => {
  it("maps a sample sheet row to the doc's payload, field for field and in key order", () => {
    const payload = buildOemPayload(
      leadFrom({
        mobile: "8823098494",
        customerName: "Rama",
        modelSlug: "1188",
        customerCitySlug: "new-delhi",
        areaName: "2",
        pincode: "110003",
      }),
    );
    expect(payload).toEqual(DOC_SAMPLE_SHAPE);
    expect(Object.keys(payload)).toEqual(Object.keys(DOC_SAMPLE_SHAPE));
    expect(oemLeadPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("uses types from the doc: string phone, numeric ids and pincode", () => {
    const payload = buildOemPayload(
      leadFrom({
        mobile: "09911897324",
        customerName: "pooja",
        modelSlug: "Curvv EV",
        customerCitySlug: "Bengaluru",
        areaName: "",
        pincode: "560001",
      }),
    );
    expect(payload.customerNumber).toBe("9911897324");
    expect(payload.interestedModelId).toBe(1348);
    expect(payload.customerCitySlug).toBe("bangalore");
    expect(payload.customerAreaId).toBe(2);
    expect(payload.pinCode).toBe(560001);
  });

  it("schema rejects unknown fields and wrong makes", () => {
    expect(oemLeadPayloadSchema.safeParse({ ...DOC_SAMPLE_SHAPE, extra: 1 }).success).toBe(false);
    expect(oemLeadPayloadSchema.safeParse({ ...DOC_SAMPLE_SHAPE, interestedMakeId: 70 }).success).toBe(false);
    expect(oemLeadPayloadSchema.safeParse({ ...DOC_SAMPLE_SHAPE, interestedModelId: 1 }).success).toBe(false);
  });
});
