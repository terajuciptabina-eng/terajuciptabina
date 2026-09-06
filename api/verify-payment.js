// api/verify-payment.js
// Verifies the paid status directly with toyyibPay before the quotation is unlocked.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { billCode, orderId, expectedAmount } = req.body || {};
    if (!billCode || !orderId || Number(expectedAmount) !== 49) {
      return res.status(400).json({ paid: false, message: "Invalid verification request." });
    }

    const secret = process.env.TOYYIBPAY_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ paid: false, message: "Payment gateway is not configured yet." });
    }

    const form = new URLSearchParams();
    form.set("billCode", String(billCode));
    form.set("billpaymentStatus", "1");

    const gateway = await fetch("https://toyyibpay.com/index.php/api/getBillTransactions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const data = await gateway.json().catch(() => []);
    const transactions = Array.isArray(data) ? data : [];
    const match = transactions.find(t =>
      String(t.billExternalReferenceNo || "") === String(orderId) &&
      String(t.billpaymentStatus || "") === "1" &&
      Math.abs(Number(t.billpaymentAmount || 0) - 49) < 0.01
    );

    return res.status(200).json({ paid: !!match });
  } catch (_) {
    return res.status(500).json({ paid: false, message: "Payment verification failed." });
  }
}
