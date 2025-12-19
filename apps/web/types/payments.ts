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

export type PayoutBalance = {
  available: number; // cents
  pending: number; // cents
  currency: string;
};

export type PayoutHistoryItem = {
  id: string;
  amount: number; // net cents
  gross_amount?: number;
  platform_fee?: number;
  status: "paid" | "pending" | "failed" | "cancelled";
  arrival_date?: string;
  created_at: string;
  bookings_count?: number;
  statement_url?: string;
};
