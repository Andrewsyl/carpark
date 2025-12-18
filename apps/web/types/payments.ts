export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  created_at?: string;
};

export type PaymentHistoryItem = {
  id: string;
  booking_id?: string;
  amount: number; // cents
  currency: string;
  status: "succeeded" | "pending" | "failed" | "refunded";
  description?: string;
  created_at: string;
  receipt_url?: string;
};
