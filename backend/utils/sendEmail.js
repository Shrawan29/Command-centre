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
    const error = new Error(`Resend API failed with status ${response.status}: ${errorBody || response.statusText}`);
    error.code = "EMAIL_DELIVERY_FAILED";
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

  await transporter.sendMail(mailOptions);
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