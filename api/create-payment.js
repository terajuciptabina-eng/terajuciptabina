export default async function handler(req, res) {
  // Allow requests from the Teraju Ciptabina GitHub Pages website
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://terajuciptabina-eng.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST is allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      message: "Method not allowed",
    });
  }

  try {
    const {
      clientOrderId,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body || {};

    if (!clientOrderId) {
      return res.status(400).json({
        message: "Missing clientOrderId",
      });
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({
        message: "Missing customer information",
      });
    }

    const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
    const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;

    if (!secretKey || !categoryCode || !publicBaseUrl) {
      return res.status(500).json({
        message: "Payment configuration is incomplete.",
      });
    }

    // Detailed quotation price = RM49
    const amount = 4900;

    const formData = new URLSearchParams();

    formData.append("userSecretKey", secretKey);
    formData.append("categoryCode", categoryCode);
    formData.append("billName", "Detailed Quotation");
    formData.append(
      "billDescription",
      "Teraju Works Detailed Quotation"
    );
    formData.append("billPriceSetting", "1");
    formData.append("billPayorInfo", "1");
    formData.append("billAmount", String(amount));
    formData.append("billReturnUrl", `${publicBaseUrl}/quotation/payment-return`);
    formData.append(
      "billCallbackUrl",
      `${publicBaseUrl}/api/payment-callback`
    );
    formData.append(
      "billExternalReferenceNo",
      clientOrderId
    );
    formData.append("billTo", customerName);
    formData.append("billEmail", customerEmail);
    formData.append("billPhone", customerPhone);
    formData.append("billContentEmail", "0");
    formData.append("billChargeToCustomer", "0");
    formData.append("billExpiryDays", "1");

    const response = await fetch(
      "https://toyyibpay.com/index.php/api/createBill",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    const result = await response.json();

    if (!response.ok || !Array.isArray(result) || !result[0]?.BillCode) {
      console.error("toyyibPay createBill response:", result);

      return res.status(502).json({
        message: "Unable to create payment.",
      });
    }

    const billCode = result[0].BillCode;

    return res.status(200).json({
      success: true,
      billCode,
      paymentUrl: `https://toyyibpay.com/${billCode}`,
      clientOrderId,
    });
  } catch (error) {
    console.error("create-payment error:", error);

    return res.status(500).json({
      message: "Unable to create the payment. Please try again.",
    });
  }
}
