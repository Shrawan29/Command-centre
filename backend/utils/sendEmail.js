import nodemailer from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

async function sendWithResend({ to, subject, text, apiKey, from }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
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

async function sendWithSmtp({ to, subject, text, emailUser, emailPass }) {
  const sanitizedPass = (emailPass || "").replace(/\s+/g, "");

  if (!emailUser || !sanitizedPass) {
    const error = new Error("Missing EMAIL_USER or EMAIL_PASS environment variable");
    error.code = "EMAIL_CONFIG";
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: emailUser,
      pass: sanitizedPass,
    },
    tls: {
      servername: "smtp.gmail.com",
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  });

  const mailOptions = {
    from: emailUser,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    const normalizedMessage = String(error?.message || "").toLowerCase();

    if (
      ["EAUTH", "EENVELOPE"].includes(error?.code) ||
      normalizedMessage.includes("username") ||
      normalizedMessage.includes("password") ||
      normalizedMessage.includes("authentication") ||
      normalizedMessage.includes("invalid login") ||
      normalizedMessage.includes("from") ||
      normalizedMessage.includes("sender")
    ) {
      error.code = "EMAIL_CONFIG";
    } else {
      error.code = "EMAIL_DELIVERY_FAILED";
    }

    throw error;
  }

  console.log("Email sent successfully (Gmail SMTP)");
}

const sendEmail = async (to, subject, text) => {
  const resendApiKey = process.env.RESEND_APIKEY?.trim();
  const resendFrom = process.env.RESEND_FROM?.trim();
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailPass = process.env.EMAIL_PASS || "";

  const hasResendConfig = Boolean(resendApiKey && resendFrom);
  const hasSmtpConfig = Boolean(emailUser && emailPass.trim());

  if (!hasResendConfig && !hasSmtpConfig) {
    const error = new Error("Email service is not configured. Set RESEND_APIKEY/RESEND_FROM or EMAIL_USER/EMAIL_PASS.");
    error.code = "EMAIL_CONFIG";
    throw error;
  }

  if (hasResendConfig) {
    try {
      await sendWithResend({ to, subject, text, apiKey: resendApiKey, from: resendFrom });
      return;
    } catch (error) {
      if (!hasSmtpConfig) {
        throw error;
      }

      console.warn("Resend failed, falling back to Gmail SMTP:", error.message);
    }
  }

  await sendWithSmtp({
    to,
    subject,
    text,
    emailUser,
    emailPass,
  });
};

export default sendEmail;