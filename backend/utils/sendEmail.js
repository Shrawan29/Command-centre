import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

async function sendWithResend({ to, subject, text, html, attachments, apiKey, from }) {
  const payload = {
    from,
    to: [to],
    subject,
    text,
  };

  if (html) payload.html = html;
  if (Array.isArray(attachments) && attachments.length) payload.attachments = attachments;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const normalizedBody = String(errorBody || "").toLowerCase();
    const error = new Error(`Resend API failed with status ${response.status}: ${errorBody || response.statusText}`);

    // 401/403 and most 4xx here usually indicate sender/domain or API key configuration issues.
    if (
      [400, 401, 403, 404, 422].includes(response.status) ||
      normalizedBody.includes("verify") ||
      normalizedBody.includes("domain") ||
      normalizedBody.includes("from")
    ) {
      error.code = "EMAIL_CONFIG";
    } else {
      error.code = "EMAIL_DELIVERY_FAILED";
    }

    throw error;
  }

  console.log("Email sent successfully (Resend API)");
}

const sendEmail = async (to, subject, text, options = {}) => {
  const resendApiKey = process.env.RESEND_APIKEY?.trim();
  const resendFrom = process.env.RESEND_FROM?.trim();

  if (!resendApiKey || !resendFrom) {
    const error = new Error("Email service is not configured. Set RESEND_APIKEY and RESEND_FROM.");
    error.code = "EMAIL_CONFIG";
    throw error;
  }

  await sendWithResend({
    to,
    subject,
    text,
    html: options?.html,
    attachments: options?.attachments,
    apiKey: resendApiKey,
    from: resendFrom,
  });
};

export default sendEmail;