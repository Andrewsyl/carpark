import React from "react";
import { render, userEvent, waitFor } from "@testing-library/react-native";
import { BookingSummaryScreen } from "../screens/BookingSummaryScreen";

jest.mock("../auth", () => ({
  useAuth: () => ({
    token: "test-token",
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

jest.mock("../api", () => ({
  getListing: jest.fn().mockResolvedValue({
    id: "listing-1",
    title: "Test space",
    address: "1 Test Street",
    price_per_day: 12,
    availability_text: "24/7",
    amenities: [],
    image_urls: [],
  }),
  createBookingPaymentIntent: jest.fn().mockResolvedValue({
    paymentIntentClientSecret: "secret",
    paymentIntentId: "pi_123",
    customerId: "cus_123",
    ephemeralKeySecret: "eph_123",
  }),
  confirmBookingPayment: jest.fn(),
}));

const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
};

const route = {
  key: "BookingSummary",
  name: "BookingSummary",
  params: {
    id: "listing-1",
    from: new Date().toISOString(),
    to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
};

describe("BookingSummaryScreen", () => {
  it("renders the booking summary header", async () => {
    const { getByText } = render(
      <BookingSummaryScreen navigation={navigation as any} route={route as any} />
    );

    await waitFor(() => expect(getByText("Booking summary")).toBeTruthy());
  });

  it("starts payment when tapping the reserve button", async () => {
    const { getByText } = render(
      <BookingSummaryScreen navigation={navigation as any} route={route as any} />
    );
    const user = userEvent.setup();

    await waitFor(() => expect(getByText("Pay & reserve")).toBeTruthy());
    await user.press(getByText("Pay & reserve"));

    const api = require("../api");
    await waitFor(() => expect(api.createBookingPaymentIntent).toHaveBeenCalled());
  });
});
