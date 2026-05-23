import { env } from "../config/env.js";

const apiInstance = new TransactionalEmailsApi();
apiInstance.authentications["apiKey"].apiKey = process.env.BREVO_API_KEY;

function buildOtpEmailContent(otpCode, purpose = "signup") {
  const expiresText = "1 minute";
  const actionText =
    purpose === "forgot_password"
      ? "reset your ChatApp password"
      : "complete your ChatApp account verification";
  const subject =
    purpose === "forgot_password"
      ? "ChatApp password reset verification code"
      : "ChatApp account verification code";

  const text = `Hello,

We received a request to ${actionText}.

Your one-time verification code is: ${otpCode}
This code will expire in ${expiresText}.

For your security:
- Never share this code with anyone.
- ChatApp support will never ask for your OTP.
- If you did not request this code, you can safely ignore this email.

This message was sent by ChatApp Security.`;

  return { subject, text };
}

export async function sendOtpEmail(email, otpCode, purpose = "signup") {
  if (!process.env.BREVO_API_KEY) {
    console.log(`[OTP] ${email}: ${otpCode}`);
    return { delivered: false, preview: otpCode };
  }

  try {
    const { subject, text } = buildOtpEmailContent(otpCode, purpose);
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.sender = { email: env.smtpFrom || "no-reply@mixichat.com", name: "Mixi" };
    sendSmtpEmail.to = [{ email }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[OTP] Email sent to ${email}`);
    return { delivered: true };
  } catch (err) {
    console.error("[OTP] Brevo failed:", err.message);
    return { delivered: false };
  }
}