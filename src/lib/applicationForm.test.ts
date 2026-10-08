import { describe, it, expect } from "vitest";
import {
  ministrySteps, sacramentSteps, validateStep, toFormData, reviewRows,
  isPlausiblePhone, type Answers,
} from "./applicationForm";

const personal = (over: Answers = {}): Answers => ({
  fullName: "Juan Dela Cruz",
  mobile: "0917 555 1234",
  ...over,
});

describe("what each ministry asks", () => {
  it("asks everyone who they are and how to reach them", () => {
    const [step] = ministrySteps("min-altar-servers", "Ministry of Altar Servers (MAS)");
    expect(step!.fields.map(f => f.name)).toContain("fullName");
    expect(step!.fields.map(f => f.name)).toContain("mobile");
  });

  it("asks altar servers about serving, and does not ask them to sing", () => {
    const names = ministrySteps("min-altar-servers", "Altar Servers")
      .flatMap(s => s.fields.map(f => f.name));
    expect(names).toContain("servedBefore");
    expect(names).not.toContain("voicePart");
  });

  it("asks a choir about singing, and does not ask about the altar", () => {
    // Matched on the name, because the parish has several choirs added
    // under different id conventions.
    const names = ministrySteps("min-marian-youth-choir", "Marian Youth Choir")
      .flatMap(s => s.fields.map(f => f.name));
    expect(names).toContain("voicePart");
    expect(names).toContain("instrument");
    expect(names).not.toContain("servedBefore");
  });

  it("asks lectors which languages they can read", () => {
    const names = ministrySteps("min-lectors", "Lectors")
      .flatMap(s => s.fields.map(f => f.name));
    expect(names).toContain("languages");
  });

  it("a ministry with nothing special still gets a complete form", () => {
    const steps = ministrySteps("min-greeters", "Greeters and Collectors");
    const names = steps.flatMap(s => s.fields.map(f => f.name));
    // No bespoke questions, but still the common ones - an unknown
    // ministry must not produce an empty form.
    expect(names).toContain("fullName");
    expect(names).toContain("message");
    expect(names).toContain("availability");
    expect(names).toContain("consent");
  });

  it("never asks a sacrament's questions of a ministry", () => {
    const names = ministrySteps("min-greeters", "Greeters")
      .flatMap(s => s.fields.map(f => f.name));
    expect(names).not.toContain("preferredDate");
  });
});

describe("what a sacrament asks", () => {
  it("asks for a preferred date and calls it a request, not a booking", () => {
    const steps = sacramentSteps("Holy Baptism");
    const field = steps.flatMap(s => s.fields).find(f => f.name === "preferredDate");
    expect(field?.required).toBe(true);
    expect(field?.help).toMatch(/confirm/i);
  });

  it("asks which documents are ready without inventing a requirement", () => {
    const field = sacramentSteps("Holy Baptism")
      .flatMap(s => s.fields).find(f => f.name === "documentsReady");
    // Optional, because the real requirements are the parish's and live
    // in data.ts. This only records what the applicant already has.
    expect(field?.required).toBe(false);
    expect(field?.options).toContain("None of these yet");
  });
});

describe("validation", () => {
  const steps = ministrySteps("min-altar-servers", "Altar Servers");

  it("will not let an empty first step through", () => {
    const errors = validateStep(steps[0]!, {});
    expect(errors.fullName).toMatch(/please enter/i);
    expect(errors.mobile).toMatch(/please enter/i);
  });

  it("says nothing about the optional fields", () => {
    const errors = validateStep(steps[0]!, personal());
    expect(errors).toEqual({});
  });

  it("treats whitespace as empty", () => {
    const errors = validateStep(steps[0]!, personal({ fullName: "   " }));
    expect(errors.fullName).toBeTruthy();
  });

  it("rejects a contact number that is not one", () => {
    expect(validateStep(steps[0]!, personal({ mobile: "call me" })).mobile)
      .toMatch(/contact number/i);
  });

  it("accepts the ways people really write a number", () => {
    for (const n of ["09175551234", "0917 555 1234", "+63 917 555 1234", "8-123-4567"]) {
      expect(isPlausiblePhone(n)).toBe(true);
    }
    expect(isPlausiblePhone("123")).toBe(false);
    expect(isPlausiblePhone("")).toBe(false);
  });

  it("requires at least one availability, since the point is when you can serve", () => {
    const about = steps[1]!;
    const errors = validateStep(about, { message: "I would like to help." });
    expect(errors.availability).toMatch(/choose at least one/i);
  });

  it("requires the consent tick and will not take a string for it", () => {
    const last = steps[steps.length - 1]!;
    expect(validateStep(last, {}).consent).toBeTruthy();
    expect(validateStep(last, { consent: "yes" }).consent).toBeTruthy();
    expect(validateStep(last, { consent: true })).toEqual({});
  });
});

describe("what gets written to the application", () => {
  const steps = ministrySteps("min-altar-servers", "Altar Servers");
  const answers: Answers = {
    ...personal(),
    message: "  I would like to help.  ",
    availability: ["Saturday", "Sunday"],
    address: "",
    consent: true,
  };

  it("trims text and joins the multi-choice answers", () => {
    const data = toFormData(steps, answers);
    expect(data.message).toBe("I would like to help.");
    expect(data.availability).toBe("Saturday, Sunday");
    expect(data.consent).toBe(true);
  });

  it("leaves out what was not answered rather than writing empty strings", () => {
    // The parish's spreadsheet export reads these keys. A column of ""
    // reads as data that was lost, not as a question nobody answered.
    const data = toFormData(steps, answers);
    expect(data).not.toHaveProperty("address");
    expect(data).not.toHaveProperty("emergencyName");
  });

  it("the review shows what was answered, and nothing else", () => {
    const rows = reviewRows(steps, answers);
    const labels = rows.map(r => r.label);
    expect(rows.find(r => r.value === "Juan Dela Cruz")).toBeTruthy();
    expect(rows.find(r => r.value === "Saturday, Sunday")).toBeTruthy();
    // The consent tick is an agreement, not an answer to read back.
    expect(labels.some(l => /may keep these details/i.test(l))).toBe(false);
    // Blank optional answers are left out, not shown as a dash.
    expect(labels).not.toContain("Address");
  });
});
