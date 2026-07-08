import { Link, useSearchParams } from "react-router-dom";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const status = (params.get("status") || "").toLowerCase();
  const tranId = params.get("tran_id");
  const amount = params.get("amount");
  const invoiceId = params.get("value_a");

  const isSuccess =
    status === "valid" || status === "success" || status === "paid";
  const isCancelled = status === "cancelled" || status === "cancel";
  const isFailed = !isSuccess && !isCancelled;

  const config = isSuccess
    ? {
        title: "Payment Successful",
        msg: "Your payment was confirmed.",
        color: "text-green-600",
        bg: "bg-green-50",
      }
    : isCancelled
      ? {
          title: "Payment Cancelled",
          msg: "You cancelled the payment.",
          color: "text-slate-700",
          bg: "bg-slate-100",
        }
      : {
          title: "Payment Failed",
          msg: "The payment could not be processed.",
          color: "text-red-600",
          bg: "bg-red-50",
        };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow border border-slate-200 p-8 w-full max-w-md text-center">
        <h1 className={`text-2xl font-bold mb-2 ${config.color}`}>
          {config.title}
        </h1>
        <p className="text-slate-600 mb-4">{config.msg}</p>

        <div
          className={`${config.bg} rounded p-4 text-sm text-left mb-6 space-y-1`}
        >
          {tranId && (
            <div>
              <span className="text-slate-500">Transaction ID:</span> {tranId}
            </div>
          )}
          {amount && (
            <div>
              <span className="text-slate-500">Amount:</span> ৳{amount}
            </div>
          )}
        </div>

        {invoiceId ? (
          <Link
            to={`/invoices/${invoiceId}`}
            className="inline-block px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            View Invoice
          </Link>
        ) : (
          <Link
            to="/invoices"
            className="inline-block px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Go to Invoices
          </Link>
        )}
      </div>
    </div>
  );
}
