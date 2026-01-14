import React from "react";
import { render, userEvent } from "@testing-library/react-native";
import { SearchScreen } from "../screens/SearchScreen";

jest.mock("../auth", () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock("../appLaunch", () => ({
  useAppLaunch: () => ({ launchComplete: true }),
}));

jest.mock("../favorites", () => ({
  useFavorites: () => ({
    favorites: [],
    isFavorite: jest.fn().mockReturnValue(false),
    toggle: jest.fn(),
  }),
}));

jest.mock("../api", () => ({
  searchListings: jest.fn().mockResolvedValue([]),
}));

jest.mock("../components/MapSection", () => {
  const React = require("react");
  const { View } = require("react-native");
  return () => <View />;
});

jest.mock("../components/MapBottomCard", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MapBottomCard: () => <View /> };
});

const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
};

const route = { key: "Search", name: "Search", params: undefined };

describe("SearchScreen", () => {
  it("renders the search input", () => {
    const { getByPlaceholderText } = render(
      <SearchScreen navigation={navigation as any} route={route as any} />
    );

    expect(getByPlaceholderText("Where to?")).toBeTruthy();
  });

  it("opens the search sheet when tapping the search bar", async () => {
    const { getByTestId, getByText } = render(
      <SearchScreen navigation={navigation as any} route={route as any} />
    );
    const user = userEvent.setup();

    await user.press(getByTestId("search-bar"));
    expect(getByText("Search")).toBeTruthy();
  });
});
