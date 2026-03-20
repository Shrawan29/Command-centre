import nodemailer from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

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

  await transporter.sendMail(mailOptions);

  console.log("Email sent successfully");
};

export default sendEmail;