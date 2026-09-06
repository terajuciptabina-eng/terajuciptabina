export default async function handler(req, res) {
  // Allow requests from the Teraju Ciptabina website
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://terajuciptabina-eng.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // toyyibPay sends callback using POST
  if (req.method !== "POST") {
    return res.status(405).json({
      message: "Method not allowed",
    });
  }

  try {
    const {
      refno,
      status,
      reason,
      billcode,
      order_id,
      amount,
      transaction_time,
      hash,
    } = req.body || {};

    const secretKey = process.env.TOYYIBPAY_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        message: "Payment configuration is incomplete.",
      });
    }

    /*
      toyyibPay callback hash:
      MD5(userSecretKey + status + order_id + refno + "ok")
    */

    const crypto = await import("crypto");

    const expectedHash = crypto
      .createHash("md5")
      .update(
        secretKey +
        String(status || "") +
        String(order_id || "") +
        String(refno || "") +
        "ok"
      )
      .digest("hex");

    const hashIsValid =
      String(hash || "").toLowerCase() === expectedHash.toLowerCase();

    if (!hashIsValid) {
      console.error("Invalid toyyibPay callback hash.");

      return res.status(400).json({
        message: "Invalid callback signature.",
      });
    }

    console.log("Verified toyyibPay callback:", {
      refno,
      status,
      reason,
      billcode,
      order_id,
      amount,
      transaction_time,
    });

    /*
      At this stage the callback is only used as a verified
      notification.

      The frontend still performs its own server-side
      payment verification through /api/verify-payment
      before unlocking the Detailed Quotation.
    */

    return res.status(200).json({
      success: true,
    });

  } catch (error) {
    console.error("payment-callback error:", error);

    return res.status(500).json({
      message: "Callback processing failed.",
    });
  }
}
