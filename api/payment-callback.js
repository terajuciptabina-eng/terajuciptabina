// api/payment-callback.js
// Server-side callback endpoint. Logs/validates successful callbacks.
// A database can be added later if you want permanent order records.

import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const {
    status = "",
    order_id = "",
    refno = "",
    hash = ""
  } = req.body || {};

  const secret = process.env.TOYYIBPAY_SECRET_KEY || "";
  const expected = crypto
    .createHash("md5")
    .update(secret + status + order_id + refno + "ok")
    .digest("hex");

  if (!secret || !hash || hash !== expected) {
    return res.status(400).send("Invalid callback");
  }

  // status 1 = successful, 2 = pending, 3 = failed.
  // Payment verification is still performed by /api/verify-payment
  // before the frontend unlocks the detailed quotation.
  return res.status(200).send("OK");
}
