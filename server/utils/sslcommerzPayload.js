import { formatMinorAmount } from "./money.js";

export function buildSslCommerzPayload({
  invoice,
  userId,
  tranId,
  amountMinor,
  signature,
  baseUrl,
}) {
  return {
    total_amount: formatMinorAmount(amountMinor),
    currency: invoice.currency,
    tran_id: tranId,
    success_url: `${baseUrl}/api/payment/success`,
    fail_url: `${baseUrl}/api/payment/fail`,
    cancel_url: `${baseUrl}/api/payment/cancel`,
    ipn_url: `${baseUrl}/api/payment/ipn`,
    shipping_method: "No",
    product_name: invoice.invoiceNumber,
    productcategory: "Service",
    product_category: "Service",
    product_profile: "non-physical-goods",
    cus_name: invoice.clientName,
    cus_email: invoice.clientEmail,
    cus_add1: "N/A",
    cus_city: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: "0000000000",
    value_a: invoice._id.toString(),
    value_b: userId.toString(),
    value_c: signature,
  };
}
