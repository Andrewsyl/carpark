import React from "react";
import { render, userEvent } from "@testing-library/react-native";
import { SignInScreen } from "../screens/SignInScreen";

jest.mock("../auth", () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    loginWithOAuth: jest.fn(),
    acceptLegal: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock("../api", () => ({
  requestEmailVerification: jest.fn(),
}));

const navigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
};

const route = { key: "SignIn", name: "SignIn", params: undefined };

describe("SignInScreen", () => {
  it("renders the sign-in header", () => {
    const { getAllByText, getByText } = render(
      <SignInScreen navigation={navigation as any} route={route as any} />
    );

    expect(getAllByText("Sign in").length).toBeGreaterThan(0);
    expect(getByText("Email")).toBeTruthy();
  });

  it("shows a validation error for invalid email on sign-in", async () => {
    const { getByPlaceholderText, getByText, getByTestId } = render(
      <SignInScreen navigation={navigation as any} route={route as any} />
    );
    const user = userEvent.setup();

    await user.type(getByPlaceholderText("you@example.com"), "invalid");
    await user.type(getByPlaceholderText("••••••••"), "123456");
    await user.press(getByTestId("sign-in-button"));

    expect(getByText("Enter a valid email address.")).toBeTruthy();
  });

  it("requires terms acceptance before creating an account", async () => {
    const { getByPlaceholderText, getByText } = render(
      <SignInScreen navigation={navigation as any} route={route as any} />
    );
    const user = userEvent.setup();

    await user.type(getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(getByPlaceholderText("••••••••"), "123456");
    await user.press(getByText("Create account"));

    expect(getByText("Please accept the Terms & Privacy to create an account.")).toBeTruthy();
  });
});
