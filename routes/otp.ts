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

async function saveOtpToNocoDB(email: string, otp: string) {
  try {
    const { data, error } = await supabase
      .from("otp")
      .insert([{ email, otp }])
      .select();
  } catch (error) {
    console.error("Failed to save OTP to NocoDB:", error);
  }
}

export function registerOtpRoutes(router: Router) {
  router.post("/api/otp/generate", async (req: Request) => {
    try {
      const { email } = await req.json();
      const otp = generateOTP();
      // Add it to nocodb

      await saveOtpToNocoDB(email, otp);

      const html = getEmailHtml({ otp: otp }, "email_templates/otp.html");

      await sendEmail(
        email,
        "Your code for aviator.",
        `Your OTP is ${otp}`,
        html,
      );

      return new Response(
        JSON.stringify({ message: "OTP generated successfully" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error generating OTP:", error);
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
  router.post("/api/otp/verify", async (req: Request) => {
    try {
      const { email, otp } = await req.json();

      const { data, error } = await supabase
        .from("otp")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false });

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Invalid OTP or email" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // verify otp provided and the one in the database match
      console.log("Expected otp" + data[0].otp);
      console.log("Provided otp" + otp);

      if (String(data[0].otp) !== String(otp)) {
        return new Response(JSON.stringify({ error: "Invalid OTP" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // If OTP is valid, delete it from the database

      const { error: deleteError } = await supabase
        .from("otp")
        .delete()
        .eq("email", email)
        .eq("otp", otp);

      if (deleteError) {
        return new Response(JSON.stringify({ error: "Failed to delete OTP" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ message: "OTP verified successfully" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
