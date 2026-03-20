import nodemailer from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

async function sendViaResend({ to, subject, text, from }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API error (${response.status}): ${body || response.statusText}`);
  }

  return true;
}

const sendEmail = async (to, subject, text) => {
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

  if (!emailUser || !emailPass) {
    throw new Error("Missing EMAIL_USER or EMAIL_PASS environment variable");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      servername: "smtp.gmail.com",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const mailOptions = {
    from: emailUser,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully (SMTP)");
  } catch (error) {
    const networkBlocked = ["ETIMEDOUT", "ESOCKET", "ENETUNREACH", "ECONNREFUSED", "EHOSTUNREACH"]
      .includes(error?.code);

    if (networkBlocked) {
      const sent = await sendViaResend({
        to,
        subject,
        text,
        from: emailUser,
      });

      if (sent) {
        console.log("Email sent successfully (Resend fallback)");
        return;
      }

      throw new Error("SMTP unreachable from server. Configure RESEND_API_KEY (and optional RESEND_FROM) for HTTPS email fallback.");
    }

    throw error;
  }
};

export default sendEmail;