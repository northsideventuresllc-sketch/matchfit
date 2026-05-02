import { describe, expect, it } from "vitest";
import { moderateClientTrainerTestimonial } from "@/lib/client-trainer-review-moderation";

describe("client trainer testimonial moderation", () => {
  it("passes normal fitness copy", () => {
    const r = moderateClientTrainerTestimonial("Amazing coach — helped me dial in form and nutrition.");
    expect(r.testimonialModerated).toBe(false);
    expect(r.testimonialText).toContain("Amazing coach");
  });

  it("strips testimonials with off-platform payment cues", () => {
    const r = moderateClientTrainerTestimonial("Great trainer, pay me on venmo for a discount.");
    expect(r.testimonialModerated).toBe(true);
    expect(r.testimonialText).toBeNull();
  });

  it("strips zero-tolerance phrases", () => {
    const r = moderateClientTrainerTestimonial("You should kill yourself.");
    expect(r.testimonialModerated).toBe(true);
    expect(r.testimonialText).toBeNull();
  });

  it("treats empty as no testimonial", () => {
    const r = moderateClientTrainerTestimonial("   ");
    expect(r.testimonialModerated).toBe(false);
    expect(r.testimonialText).toBeNull();
  });
});
