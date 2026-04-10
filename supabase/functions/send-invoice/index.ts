import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      agentName,
      agentEmail,
      tourName,
      pdfBase64,
      recipients,
      invoiceDetails,
    } = await req.json();

    // --- BANKING DATA: Stored as Supabase Secrets, NEVER in frontend ---
    const PAYMENT_CVR   = Deno.env.get("PAYMENT_CVR")   ?? "46389506";
    const PAYMENT_BANK  = Deno.env.get("PAYMENT_BANK")  ?? "N26";
    const PAYMENT_IBAN  = Deno.env.get("PAYMENT_IBAN")  ?? "";
    const PAYMENT_SWIFT = Deno.env.get("PAYMENT_SWIFT") ?? "";

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured in Supabase secrets.");

    const toList: string[] = Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : ["info@freetourcph.com", "buchinisantiago@gmail.com"];

    const { legalName, cvr, address, notes } = invoiceDetails ?? {};

    const emailHtml = `
      <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0a0a0a; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #FF6B00; margin: 0; font-size: 24px;">B2B Tour Copenhagen</h1>
          <p style="color: #ccc; margin: 8px 0 0 0; font-size: 14px;">New Invoice Request</p>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #222; font-size: 18px; margin-top: 0;">📋 Tour Details</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>Tour:</strong></td><td>${tourName}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Agent Name:</strong></td><td>${agentName}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Agent Email:</strong></td><td>${agentEmail}</td></tr>
          </table>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

          <h2 style="color: #222; font-size: 18px;">🏢 Billed To</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>Company:</strong></td><td>${legalName ?? "N/A"}</td></tr>
            ${cvr ? `<tr><td style="padding: 6px 0; color: #555;"><strong>CVR/VAT:</strong></td><td>${cvr}</td></tr>` : ""}
            ${address ? `<tr><td style="padding: 6px 0; color: #555;"><strong>Address:</strong></td><td>${address}</td></tr>` : ""}
            ${notes ? `<tr><td style="padding: 6px 0; color: #555; vertical-align: top;"><strong>Notes:</strong></td><td style="font-style: italic;">${notes}</td></tr>` : ""}
          </table>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

          <h2 style="color: #222; font-size: 18px;">💳 Payment Information</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: #fff; border-radius: 8px; padding: 16px;">
            <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>CVR:</strong></td><td>${PAYMENT_CVR}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Bank:</strong></td><td>${PAYMENT_BANK}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>IBAN:</strong></td><td style="font-family: monospace; letter-spacing: 1px;">${PAYMENT_IBAN}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>SWIFT/BIC:</strong></td><td style="font-family: monospace;">${PAYMENT_SWIFT}</td></tr>
          </table>

          <div style="margin-top: 24px; padding: 16px; background: #fff8f0; border-left: 4px solid #FF6B00; border-radius: 4px; font-size: 13px; color: #555;">
            ℹ️ This quote will be reviewed and a formal invoice will be sent in the next few days.<br>
            <strong>To confirm the tour, a 50% advance deposit is required.</strong>
          </div>

          <p style="font-size: 12px; color: #aaa; margin-top: 24px;">
            B2B Tour Copenhagen &bull; +45 51 99 94 00 &bull; info@freetourcph.com<br>
            Theklavej 36, Copenhagen, Kobenhavn NV 2400
          </p>
        </div>
      </div>
    `;

    const emailPayload: Record<string, unknown> = {
      from: "B2B Tour Copenhagen <info@freetourcph.com>",
      to: toList,
      subject: `[Invoice Request] ${tourName} — ${agentName}`,
      html: emailHtml,
    };

    // Attach PDF if provided
    if (pdfBase64) {
      emailPayload.attachments = [
        {
          filename: `invoice-${tourName.replace(/\s+/g, "-")}.pdf`,
          content: pdfBase64,
        },
      ];
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resendJson = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(`Resend error: ${JSON.stringify(resendJson)}`);
    }

    return new Response(JSON.stringify({ success: true, id: resendJson.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("send-invoice error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
