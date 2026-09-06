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
      billCode,
      orderId,
    } = req.body || {};

    if (!billCode || !orderId) {
      return res.status(400).json({
        paid: false,
        message: "Missing payment information.",
      });
    }

    const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
    const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;

    if (!secretKey || !categoryCode) {
      return res.status(500).json({
        paid: false,
        message: "Payment configuration is incomplete.",
      });
    }

    /*
      Verify the bill directly with toyyibPay.
      We do NOT trust the browser's payment status.
    */

    const formData = new URLSearchParams();

    formData.append("userSecretKey", secretKey);
    formData.append("billCode", billCode);

    const response = await fetch(
      "https://toyyibpay.com/index.php/api/getBillTransactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    const result = await response.json();

    if (!response.ok || !Array.isArray(result) || result.length === 0) {
      console.error("toyyibPay verification response:", result);

      return res.status(200).json({
        paid: false,
        message: "Payment could not be verified.",
      });
    }

    /*
      Find the transaction matching the order/payment reference.

      toyyibPay transaction data can vary slightly, so we check
      the common fields safely.
    */

    const successfulTransaction = result.find((transaction) => {
      const transactionStatus =
        String(
          transaction.billpaymentStatus ??
          transaction.status ??
          transaction.status_id ??
          ""
        );

      const transactionOrderId =
        String(
          transaction.order_id ??
          transaction.orderId ??
          transaction.externalReferenceNo ??
          ""
        );

      const amount =
        Number(
          transaction.billpaymentAmount ??
          transaction.amount ??
          0
        );

      const statusIsSuccessful =
        transactionStatus === "1" ||
        transactionStatus.toLowerCase() === "success" ||
        transactionStatus.toLowerCase() === "successful";

      const amountIsCorrect =
        amount === 4900 ||
        amount === 49;

      const orderMatches =
        !transactionOrderId ||
        transactionOrderId === String(orderId);

      return (
        statusIsSuccessful &&
        amountIsCorrect &&
        orderMatches
      );
    });

    if (!successfulTransaction) {
      return res.status(200).json({
        paid: false,
        message: "Payment has not been verified.",
      });
    }

    return res.status(200).json({
      paid: true,
      billCode,
      orderId,
      message: "Payment verified successfully.",
    });

  } catch (error) {
    console.error("verify-payment error:", error);

    return res.status(500).json({
      paid: false,
      message: "Unable to verify payment.",
    });
  }
}
