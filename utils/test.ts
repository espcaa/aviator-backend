import { SMTPClient } from "smtp-client";

async function getAuthMechs() {
  const client = new SMTPClient({
    host: "mail.darkbsd.org",
    port: 587,
    tls: true, // Enable TLS
  });

  try {
    await client.connect();
    await client.greet({ hostname: "localhost" }); // Or use your own domain
    await client.secure(); // Upgrade to TLS
    await client.greet({ hostname: "localhost" }); // Re-issue EHLO
    const mechanisms = client.getAuthMechanisms();
    console.log("Supported auth mechanisms:", mechanisms);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    try {
      await client.quit();
    } catch {}
  }
}

getAuthMechs();
