import { render, userEvent, waitFor } from "@testing-library/react-native";
import { BookingSummaryScreen } from "../screens/BookingSummaryScreen";
import { GlobalLoadingProvider } from "../components/GlobalLoading";
import { GlobalToastProvider } from "../components/GlobalToast";

const mockInitPaymentSheet = jest.fn();
const mockPresentPaymentSheet = jest.fn();

jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({
    initPaymentSheet: mockInitPaymentSheet,
    presentPaymentSheet: mockPresentPaymentSheet,
  }),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("../auth", () => ({
  useAuth: () => ({
    token: "test-token",
    user: {
      id: "user-1",
      email: "test@example.com",
      phoneVerified: true,
      vehicleMake: "Ford",
      vehicleType: "Fiesta",
      vehicleColor: "Blue",
      vehiclePlate: "21-D-12345",
    },
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitPaymentSheet.mockResolvedValue({});
    mockPresentPaymentSheet.mockResolvedValue({});
  });

  it("renders the booking review header", async () => {
    const { getAllByText } = render(
      <GlobalToastProvider><GlobalLoadingProvider><BookingSummaryScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider></GlobalToastProvider>
    );

    await waitFor(() => expect(getAllByText("Confirm and pay").length).toBeGreaterThan(0));
  });

  it("starts payment when tapping the pay button", async () => {
    const { getByLabelText } = render(
      <GlobalToastProvider><GlobalLoadingProvider><BookingSummaryScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider></GlobalToastProvider>
    );
    const user = userEvent.setup({ delay: null as unknown as number });

    const payCta = await waitFor(() => getByLabelText(/^Pay €\d+\.\d{2}$/i));
    await user.press(payCta);

    const api = require("../api");
    await waitFor(() => expect(api.createBookingPaymentIntent).toHaveBeenCalled());
  });

  it("does not show an error when the user silently cancels the payment sheet", async () => {
    mockPresentPaymentSheet.mockResolvedValue({ error: { code: "Canceled" } });

    const { getByLabelText, queryByText } = render(
      <GlobalToastProvider><GlobalLoadingProvider><BookingSummaryScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider></GlobalToastProvider>
    );
    const user = userEvent.setup({ delay: null as unknown as number });

    const payCta = await waitFor(() => getByLabelText(/^Pay €\d+\.\d{2}$/i));
    await user.press(payCta);

    await waitFor(() => expect(mockPresentPaymentSheet).toHaveBeenCalled());
    expect(queryByText(/declined|failed|error/i)).toBeNull();
  });

  it("shows an error message when Stripe returns a payment failure", async () => {
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: "Failed", message: "Your card was declined." },
    });

    const { getByLabelText, findByText, findAllByText } = render(
      <GlobalToastProvider><GlobalLoadingProvider><BookingSummaryScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider></GlobalToastProvider>
    );
    const user = userEvent.setup({ delay: null as unknown as number });

    const payCta = await waitFor(() => getByLabelText(/^Pay €\d+\.\d{2}$/i));
    await user.press(payCta);

    expect(await findAllByText(/Payment not completed\. No booking was created\./i)).toBeTruthy();
  });

  it("shows an error when payment intent creation fails", async () => {
    const api = require("../api");
    api.createBookingPaymentIntent.mockRejectedValueOnce(new Error("Service unavailable"));

    const { getByLabelText, findByText, findAllByText } = render(
      <GlobalToastProvider><GlobalLoadingProvider><BookingSummaryScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider></GlobalToastProvider>
    );
    const user = userEvent.setup({ delay: null as unknown as number });

    const payCta = await waitFor(() => getByLabelText(/^Pay €\d+\.\d{2}$/i));
    await user.press(payCta);

    expect(await findByText(/Service unavailable/i)).toBeTruthy();
  });
});
