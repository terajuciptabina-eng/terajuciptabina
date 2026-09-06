// api/create-payment.js
// Vercel/Node serverless endpoint for Teraju Works.
// Required environment variables:
// TOYYIBPAY_SECRET_KEY
// TOYYIBPAY_CATEGORY_CODE
// PUBLIC_BASE_URL  e.g. https://your-domain.com
//
// Do NOT put these secrets in GitHub HTML.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const amount = Number(body.amount);
    const customer = body.customer || {};
    const project = body.project || {};
    const clientOrderId = String(body.clientOrderId || "");

    if (amount !== 49) {
      return res.status(400).json({ message: "Invalid payment amount." });
    }
    if (!customer.name || !customer.email || !customer.phone || !clientOrderId) {
      return res.status(400).json({ message: "Missing customer or order information." });
    }

    const secret = process.env.TOYYIBPAY_SECRET_KEY;
    const category = process.env.TOYYIBPAY_CATEGORY_CODE;
    const baseUrl = process.env.PUBLIC_BASE_URL;

    if (!secret || !category || !baseUrl) {
      return res.status(500).json({ message: "Payment gateway is not configured yet." });
    }

    const form = new URLSearchParams();
    form.set("userSecretKey", secret);
    form.set("categoryCode", category);
    form.set("billName", "Detailed Quotation");
    form.set("billDescription", "Teraju Works Detailed Quotation");
    form.set("billPriceSetting", "1");
    form.set("billPayorInfo", "1");
    form.set("billAmount", "4900");
    form.set("billReturnUrl", `${baseUrl}/quotation/payment-return`);
    form.set("billCallbackUrl", `${baseUrl}/api/payment-callback`);
    form.set("billExternalReferenceNo", clientOrderId);
    form.set("billTo", String(customer.name).slice(0, 200));
    form.set("billEmail", String(customer.email).slice(0, 200));
    form.set("billPhone", String(customer.phone).slice(0, 30));
    form.set("billExpiryDays", "1");
    form.set("billPaymentChannel", "0");

    const gateway = await fetch("https://toyyibpay.com/index.php/api/createBill", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const data = await gateway.json().catch(() => null);
    const billCode = data?.[0]?.BillCode;

    if (!gateway.ok || !billCode) {
      return res.status(502).json({ message: "toyyibPay did not return a bill code." });
    }

    return res.status(200).json({
      paymentUrl: `https://toyyibpay.com/${billCode}`,
      billCode,
      orderId: clientOrderId
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create payment bill." });
  }
}
