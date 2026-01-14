import "@testing-library/jest-native/extend-expect";

jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper");

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, []);
    },
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return {
    __esModule: true,
    default: Mock,
    Marker: Mock,
    Callout: Mock,
    PROVIDER_GOOGLE: "google",
  };
});

jest.mock("lottie-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
});

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    hasPlayServices: jest.fn(),
  },
  statusCodes: {},
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name?: string }) => React.createElement(Text, null, name ?? "icon");
  return { MaterialIcons: Icon };
});

jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn().mockResolvedValue({}),
    presentPaymentSheet: jest.fn().mockResolvedValue({}),
  }),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 53.3498, longitude: -6.2603 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock("react-native-date-picker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
});
