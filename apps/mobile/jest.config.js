module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testMatch: ["<rootDir>/test/**/*.test.{ts,tsx}"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|@react-navigation/.*|@expo/.*|expo(nent)?|expo-.*|expo-modules-core|@expo-google-fonts/.*|react-native-.*|@stripe/stripe-react-native|lottie-react-native)/)",
  ],
};
