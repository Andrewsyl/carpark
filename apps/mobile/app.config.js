const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
  withAndroidManifest,
  withInfoPlist,
} = require("@expo/config-plugins");
const fs = require("fs");
const os = require("os");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const appJson = require("./app.json");

const withCoreKtxFix = (config) =>
  withProjectBuildGradle(config, (configMod) => {
    if (configMod.modResults.language !== "groovy") return configMod;
    if (!configMod.modResults.contents.includes("com.google.gms:google-services")) {
      configMod.modResults.contents = configMod.modResults.contents.replace(
        /classpath\('org.jetbrains.kotlin:kotlin-gradle-plugin'\)/,
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')\n    classpath('com.google.gms:google-services:4.4.4')"
      );
    }
    const block = `

subprojects {
  configurations.all {
    resolutionStrategy {
      force "androidx.core:core-ktx:1.15.0"
      force "androidx.core:core:1.15.0"
      force "com.google.android.gms:play-services-base:18.9.0"
      force "com.google.android.gms:play-services-maps:19.2.0"
      force "androidx.activity:activity:1.10.1"
      force "androidx.activity:activity-ktx:1.10.1"
      force "androidx.fragment:fragment:1.8.2"
      force "androidx.fragment:fragment-ktx:1.8.2"
      force "androidx.appcompat:appcompat:1.7.0"
    }
  }
}
`;
    if (!configMod.modResults.contents.includes('androidx.core:core-ktx:1.12.0')) {
      configMod.modResults.contents += block;
    }
    if (
      configMod.modResults.contents.includes("com.android.tools.build:gradle") &&
      !configMod.modResults.contents.includes("com.android.tools.build:gradle:8.7.3")
    ) {
      configMod.modResults.contents = configMod.modResults.contents.replace(
        "com.android.tools.build:gradle')",
        "com.android.tools.build:gradle:8.7.3')"
      );
    }
    if (!configMod.modResults.contents.includes("playServicesVersion")) {
      configMod.modResults.contents +=
        '\n\next {\n  playServicesVersion = "19.2.0"\n}\n';
    }
    return configMod;
  });

const withGoogleServicesPlugin = (config) =>
  withAppBuildGradle(config, (configMod) => {
    if (configMod.modResults.language !== "groovy") return configMod;
    if (!configMod.modResults.contents.includes("com.google.gms.google-services")) {
      configMod.modResults.contents = configMod.modResults.contents.replace(
        /apply plugin: "com.facebook.react"/,
        'apply plugin: "com.facebook.react"\napply plugin: "com.google.gms.google-services"'
      );
    }
    return configMod;
  });

const withAapt2Override = (config) =>
  withGradleProperties(config, (configMod) => {
    const props = configMod.modResults;
    const setProp = (key, value) => {
      const existing = props.find((item) => item.type === "property" && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: "property", key, value });
      }
    };
    const removeProp = (key) => {
      const index = props.findIndex((item) => item.type === "property" && item.key === key);
      if (index >= 0) {
        props.splice(index, 1);
      }
    };

    const sdkRoot =
      process.env.ANDROID_SDK_ROOT ||
      process.env.ANDROID_HOME ||
      path.join(os.homedir(), "Library", "Android", "sdk");
    const aapt2Path34 = path.join(sdkRoot, "build-tools", "34.0.0", "aapt2");
    removeProp("android.aapt2FromMavenOverride");
    if (fs.existsSync(aapt2Path34)) {
      setProp("android.aapt2FromMavenOverride", aapt2Path34);
    }
    setProp("android.disableResourceValidation", "true");
    setProp("android.enableResourceOptimizations", "false");
    setProp("android.enableR8.fullMode", "false");
    setProp("org.gradle.jvmargs", "-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError");
    setProp("org.gradle.parallel", "true");
    setProp("org.gradle.configureondemand", "true");
    setProp("org.gradle.daemon", "true");
    setProp("expo.jsEngine", "hermes");

    return configMod;
  });

const withGradleWrapperVersion = (config) =>
  withDangerousMod(config, [
    "android",
    async (configMod) => {
      const wrapperPath = path.join(
        configMod.modRequest.platformProjectRoot,
        "gradle",
        "wrapper",
        "gradle-wrapper.properties"
      );
      if (fs.existsSync(wrapperPath)) {
        const contents = fs.readFileSync(wrapperPath, "utf8");
        const updated = contents.replace(
          /distributionUrl=.*/g,
          "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip"
        );
        if (updated !== contents) {
          fs.writeFileSync(wrapperPath, updated, "utf8");
        }
      }
      return configMod;
    },
  ]);

const withForceDarkDisabled = (config) =>
  withDangerousMod(config, [
    "android",
    async (configMod) => {
      const stylesPaths = [
        path.join(
          configMod.modRequest.platformProjectRoot,
          "app",
          "src",
          "main",
          "res",
          "values",
          "styles.xml"
        ),
        path.join(
          configMod.modRequest.platformProjectRoot,
          "app",
          "src",
          "main",
          "res",
          "values-night",
          "styles.xml"
        ),
      ];
      const updateStyles = (stylesPath) => {
        if (!fs.existsSync(stylesPath)) return;
        const contents = fs.readFileSync(stylesPath, "utf8");
        let updated = contents
          .replace(
            /Theme\.AppCompat\.DayNight\.NoActionBar/g,
            "Theme.AppCompat.Light.NoActionBar"
          )
          .replace(
            /Theme\.MaterialComponents\.DayNight\.NoActionBar/g,
            "Theme.MaterialComponents.Light.NoActionBar"
          );
        if (!updated.includes("android:forceDarkAllowed")) {
          updated = updated.replace(
            /<style name="AppTheme"[^>]*>([\s\S]*?)<\/style>/,
            (match, inner) =>
              match.replace(
                inner,
                `${inner}\n    <item name="android:forceDarkAllowed">false</item>\n`
              )
          );
        }
        if (updated !== contents) {
          fs.writeFileSync(stylesPath, updated, "utf8");
        }
      };
      stylesPaths.forEach(updateStyles);
      return configMod;
    },
  ]);

const withForceDarkAllowedInManifest = (config) =>
  withAndroidManifest(config, (configMod) => {
    const application = configMod.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:forceDarkAllowed"] = "false";
    }
    return configMod;
  });

const withIosGoogleMapsKey = (config) =>
  withInfoPlist(config, (configMod) => {
    const key =
      appJson.expo?.ios?.config?.googleMapsApiKey ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      "";
    if (key) {
      configMod.modResults.GMSApiKey = key;
    }
    return configMod;
  });

module.exports = ({ config }) => {
  const base = { ...(appJson.expo ?? {}), ...(config ?? {}) };
  const easProjectId =
    base.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const extra = {
    ...(base.extra ?? {}),
    ...(easProjectId ? { eas: { ...(base.extra?.eas ?? {}), projectId: easProjectId } } : {}),
  };
  const plugins = base.plugins ?? [];
  const buildProps = [
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: 35,
        targetSdkVersion: 35,
        buildToolsVersion: "35.0.0",
        gradlePluginVersion: "8.7.3",
      },
    },
  ];

  return withGoogleServicesPlugin(
    withIosGoogleMapsKey(
      withForceDarkDisabled(
        withForceDarkAllowedInManifest(
          withGradleWrapperVersion(
            withAapt2Override(
              withCoreKtxFix({
                ...base,
                extra,
                android: {
                  ...base.android,
                  compileSdkVersion: 35,
                  targetSdkVersion: 35,
                  buildToolsVersion: "35.0.0",
                },
                plugins: [...plugins, buildProps],
              })
            )
          )
        )
      )
    )
  );
};
