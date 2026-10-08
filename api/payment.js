const ORIGIN = "https://terajuciptabina-eng.github.io";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const route = String(req.query?.route || "").trim().toLowerCase();

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!["create", "verify", "callback"].includes(route)) {
    return res.status(404).json({ message: "Payment route not found." });
  }

  if (route === "create") {
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

    try {
      const { clientOrderId, customer, project } = req.body || {};
      const customerName = customer?.name || "";
      const customerEmail = customer?.email || "";
      const customerPhone = customer?.phone || "";

      if (!clientOrderId) return res.status(400).json({ message: "Missing clientOrderId" });
      if (!customerName || !customerEmail || !customerPhone) {
        return res.status(400).json({ message: "Missing customer information" });
      }

      const projectType = String(project?.projectType || "").toLowerCase();
      let returnPath = "";

      if (projectType === "new house") {
        returnPath = "/terajuciptabina/TerajuWorks/buildplanner.html";
      } else if (projectType === "renovation") {
        returnPath = "/terajuciptabina/TerajuWorks/renovationplanner.html";
      } else {
        return res.status(400).json({ message: "Invalid project type." });
      }

      const frontendBaseUrl = ORIGIN;
      const billReturnUrl = `${frontendBaseUrl}${returnPath}`;

      // PROMO: Detailed Quotation is FREE until 31 October 2026.
      // Set this to false when the RM49 paid flow should go live.
      const BYPASS_DETAILED_QUOTATION_PROMO = true;

      if (BYPASS_DETAILED_QUOTATION_PROMO) {
        const bypassBillCode = `BYPASS-${Date.now()}`;
        const paymentUrl = `${billReturnUrl}?status_id=1&billcode=${encodeURIComponent(bypassBillCode)}&order_id=${encodeURIComponent(clientOrderId)}`;

        return res.status(200).json({
          success: true,
          bypass: true,
          promo: true,
          billCode: bypassBillCode,
          paymentUrl,
          clientOrderId
        });
      }

      const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
      const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
      const publicBaseUrl = process.env.PUBLIC_BASE_URL;

      if (!secretKey || !categoryCode || !publicBaseUrl) {
        return res.status(500).json({ message: "Payment configuration is incomplete." });
      }

      const amount = 4900;
      const formData = new URLSearchParams();
      formData.append("userSecretKey", secretKey);
      formData.append("categoryCode", categoryCode);
      formData.append("billName", "Detailed Quotation");
      formData.append("billDescription", "Teraju Works Detailed Quotation");
      formData.append("billPriceSetting", "1");
      formData.append("billPayorInfo", "1");
      formData.append("billAmount", String(amount));
      formData.append("billReturnUrl", billReturnUrl);
      formData.append("billCallbackUrl", `${publicBaseUrl}/api/payment-callback`);
      formData.append("billExternalReferenceNo", clientOrderId);
      formData.append("billTo", customerName);
      formData.append("billEmail", customerEmail);
      formData.append("billPhone", customerPhone);
      formData.append("billContentEmail", "0");
      formData.append("billChargeToCustomer", "0");
      formData.append("billExpiryDays", "1");

      const response = await fetch("https://toyyibpay.com/index.php/api/createBill", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result) || !result[0]?.BillCode) {
        console.error("toyyibPay createBill response:", result);
        return res.status(502).json({ message: "Unable to create payment." });
      }

      const billCode = result[0].BillCode;
      return res.status(200).json({
        success: true,
        billCode,
        paymentUrl: `https://toyyibpay.com/${billCode}`,
        clientOrderId
      });
    } catch (error) {
      console.error("create-payment error:", error);
      return res.status(500).json({ message: "Unable to create the payment. Please try again." });
    }
  }

  if (route === "verify") {
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

    try {
      const { billCode, orderId } = req.body || {};

      if (!billCode || !orderId) {
        return res.status(400).json({ paid: false, message: "Missing payment information." });
      }

      if (String(billCode).startsWith("BYPASS-")) {
        return res.status(200).json({
          paid: true,
          billCode,
          orderId,
          bypass: true,
          message: "Test payment bypass verified successfully."
        });
      }

      const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
      const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;

      if (!secretKey || !categoryCode) {
        return res.status(500).json({ paid: false, message: "Payment configuration is incomplete." });
      }

      const formData = new URLSearchParams();
      formData.append("userSecretKey", secretKey);
      formData.append("billCode", billCode);

      const response = await fetch("https://toyyibpay.com/index.php/api/getBillTransactions", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result) || result.length === 0) {
        console.error("toyyibPay verification response:", result);
        return res.status(200).json({ paid: false, message: "Payment could not be verified." });
      }

      const successfulTransaction = result.find((transaction) => {
        const transactionStatus = String(
          transaction.billpaymentStatus ?? transaction.status ?? transaction.status_id ?? ""
        );
        const transactionOrderId = String(
          transaction.order_id ?? transaction.orderId ?? transaction.externalReferenceNo ?? ""
        );
        const amount = Number(transaction.billpaymentAmount ?? transaction.amount ?? 0);
        const statusIsSuccessful =
          transactionStatus === "1" ||
          transactionStatus.toLowerCase() === "success" ||
          transactionStatus.toLowerCase() === "successful";
        const amountIsCorrect = amount === 100 || amount === 4900 || amount === 49;
        const orderMatches = !transactionOrderId || transactionOrderId === String(orderId);
        return statusIsSuccessful && amountIsCorrect && orderMatches;
      });

      if (!successfulTransaction) {
        return res.status(200).json({ paid: false, message: "Payment has not been verified." });
      }

      return res.status(200).json({
        paid: true,
        billCode,
        orderId,
        message: "Payment verified successfully."
      });
    } catch (error) {
      console.error("verify-payment error:", error);
      return res.status(500).json({ paid: false, message: "Unable to verify payment." });
    }
  }

  if (route === "callback") {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
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
        return res.status(500).json({ message: "Payment configuration is incomplete." });
      }

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
        return res.status(400).json({ message: "Invalid callback signature." });
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

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("payment-callback error:", error);
      return res.status(500).json({ message: "Callback processing failed." });
    }
  }
}
