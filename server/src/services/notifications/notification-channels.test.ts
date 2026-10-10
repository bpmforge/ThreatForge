/**
 * EMAIL notifications go through the shared email service (the same one that
 * sends password resets), not a separate provider stack.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const emailService = {
  isConfigured: vi.fn(),
  send: vi.fn(),
};
vi.mock("../email/index.js", () => ({ emailService }));
vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(async () => ({
    user: {
      findUnique: vi.fn(async () => ({ email: "owner@example.com" })),
    },
  })),
}));

const { sendEmail } = await import("./notification-channels.js");
const { getNotificationTemplate } = await import("./templates.js");

const template = getNotificationTemplate("THREAT_CREATED")!;
const data = {
  threatName: "SQL injection",
  severity: "HIGH",
  modelName: "Checkout",
  link: "https://threatforge.example.com/models/m1",
};

describe("sendEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the template subject and message, with the link, through the email service", async () => {
    emailService.isConfigured.mockResolvedValue(true);
    emailService.send.mockResolvedValue({ success: true, messageId: "m-1" });

    const result = await sendEmail(template, data, "user-1");

    expect(emailService.send).toHaveBeenCalledWith({
      to: "owner@example.com",
      subject: "[HIGH] New Threat: SQL injection",
      text: expect.stringContaining(data.link),
    });
    expect(result).toMatchObject({
      channel: "EMAIL",
      success: true,
      messageId: "m-1",
    });
  });

  it("reports failure instead of pretending to send when email is not configured", async () => {
    emailService.isConfigured.mockResolvedValue(false);

    const result = await sendEmail(template, data, "user-1");

    expect(emailService.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      error: "Email not configured",
    });
  });

  it("passes a send failure through", async () => {
    emailService.isConfigured.mockResolvedValue(true);
    emailService.send.mockResolvedValue({ success: false, error: "SMTP down" });

    const result = await sendEmail(template, data, "user-1");

    expect(result).toMatchObject({ success: false, error: "SMTP down" });
  });
});
