import { describe, expect, it } from "vitest";
import { bookingToken, verifyBookingToken, BOOKING_LINK_TTL_MS } from "../src/lib/messenger/booking-link";
import { messageBody } from "../src/lib/messenger/meta";

const KEY = "test-key";

describe("Messenger booking link", () => {
  it("round-trips the conversation id", () => {
    const t = bookingToken("clx123abc", 1_000_000, KEY)!;
    expect(verifyBookingToken(t, 1_000_000, KEY)).toBe("clx123abc");
  });
  it("rejects tampered, foreign-key and expired tokens", () => {
    const t = bookingToken("clx123abc", 1_000_000, KEY)!;
    const [, exp, sig] = t.split(".");
    expect(verifyBookingToken(`clx999zzz.${exp}.${sig}`, 1_000_000, KEY)).toBeNull();
    expect(verifyBookingToken(t, 1_000_000, "other-key")).toBeNull();
    expect(verifyBookingToken(t, 1_000_000 + BOOKING_LINK_TTL_MS + 2000, KEY)).toBeNull();
    expect(verifyBookingToken("garbage", 1_000_000, KEY)).toBeNull();
  });
  it("needs a key", () => {
    expect(bookingToken("clx123abc", 0, null)).toBeNull();
  });
});

describe("messageBody", () => {
  it("sends a button template when there is a link button", () => {
    const body = messageBody({ text: "Pindutin po", button: { title: "📅 Pumili ng petsa", url: "https://x.test/book/t" }, quickReplies: [{ title: "Menu", payload: "MENU" }] });
    expect(body).toMatchObject({
      attachment: { type: "template", payload: { template_type: "button", text: "Pindutin po", buttons: [{ type: "web_url", url: "https://x.test/book/t" }] } },
      quick_replies: [{ title: "Menu", payload: "MENU" }],
    });
  });
  it("sends plain text otherwise", () => {
    expect(messageBody({ text: "Hi" })).toEqual({ text: "Hi" });
  });
});
