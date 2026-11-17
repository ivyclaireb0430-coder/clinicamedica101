import { describe, expect, it } from "vitest";
import { fillTemplate, isNewVisitorComment } from "../src/lib/messenger/comments";

const base = { field: "feed", value: { item: "comment", verb: "add", comment_id: "1_2", post_id: "1_1", from: { id: "99", name: "Maria Santos" } } };

describe("comment-to-Messenger", () => {
  it("accepts a new comment from a visitor", () => {
    expect(isNewVisitorComment(base, "1")).toBe(true);
  });
  it("ignores the Page's own comments, edits, likes and other fields", () => {
    expect(isNewVisitorComment({ ...base, value: { ...base.value, from: { id: "1" } } }, "1")).toBe(false);
    expect(isNewVisitorComment({ ...base, value: { ...base.value, verb: "edited" } }, "1")).toBe(false);
    expect(isNewVisitorComment({ ...base, value: { ...base.value, item: "reaction" } }, "1")).toBe(false);
    expect(isNewVisitorComment({ ...base, field: "mention" }, "1")).toBe(false);
    expect(isNewVisitorComment({ ...base, value: { ...base.value, comment_id: undefined } }, "1")).toBe(false);
  });
  it("fills the first name, and reads cleanly without one", () => {
    expect(fillTemplate("Hi {name}! Salamat po.", "Maria Santos")).toBe("Hi Maria! Salamat po.");
    expect(fillTemplate("Hi {name}! Salamat po.", undefined)).toBe("Hi! Salamat po.");
  });
});
