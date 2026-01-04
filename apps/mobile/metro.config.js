const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

// Prevent Metro from resolving React from the workspace root, which can
// cause duplicate React copies and invalid hook calls.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "@babel/runtime": path.resolve(workspaceRoot, "node_modules/@babel/runtime"),
  "@react-native/virtualized-lists": path.resolve(
    workspaceRoot,
    "node_modules/@react-native/virtualized-lists"
  ),
};

module.exports = config;
