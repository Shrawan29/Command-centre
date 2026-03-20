import nodemailer from "nodemailer";

const sendEmail = async (to, subject, text) => {
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

  if (!emailUser || !emailPass) {
    throw new Error("Missing EMAIL_USER or EMAIL_PASS environment variable");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
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