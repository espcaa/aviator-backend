/// <reference lib="dom" />
import { Router } from "../router";

import { supabase } from "../utils/database";
import { sendEmail } from "../utils/email";
import { getEmailHtml } from "../utils/getEmailHtml";

function generateOTP(length: number = 4): string {
  const digits = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }

  return otp;
}

async function saveOtpToSupabase(email: string, otp: string) {
  try {
    const { data, error } = await supabase
      .from("otp")
      .insert([{ email, otp: String(otp) }])
      .select();
  } catch (error) {
    console.error("Failed to save OTP to Supabase:", error);
  }
}

export function registerOtpRoutes(router: Router) {
  router.post("/api/otp/generate", async (req: Request) => {
    try {
      const { email } = await req.json();
      const otp = generateOTP();

      await saveOtpToSupabase(email, otp);

      const html = getEmailHtml({ otp: otp }, "email_templates/otp.html");

      await sendEmail(
        email,
        "Your code for aviator.",
        `Your OTP is ${otp}`,
        html,
      );

      return new Response(JSON.stringify({ message: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error generating OTP:", error);
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
