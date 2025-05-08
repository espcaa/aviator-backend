const nodemailer = require("nodemailer");

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
) {
  const transporter = nodemailer.createTransport({
    host: "mail.darkbsd.org",
    port: 587,
    secure: false,
    auth: {
      user: "aviator@spectralo.me",
      pass: process.env.EMAIL_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: '"Aviator" <aviator@spectralo.me>',
    to: to, // list of receivers
    subject: subject, // Subject line
    html: html, // html body
    text: text, // plain text body
  });
}
