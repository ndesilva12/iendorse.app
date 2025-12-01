module.exports = {
  expo: {
    name: "iEndorse",
    slug: "iendorse",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/endorsing1.png",
    scheme: "iendorse",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    extra: {
      googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    },
    splash: {
      image: "./assets/images/endorsing.png",
      resizeMode: "contain",
      backgroundColor: "#111827"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.rork.playbook",
      infoPlist: {
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
        NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
        NSLocationAlwaysUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
        NSLocationWhenInUseUsageDescription: "Allow $(PRODUCT_NAME) to use your location.",
        UIBackgroundModes: [
          "location"
        ],
        NSFaceIDUsageDescription: "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
      },
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/endorsing1.png",
        backgroundColor: "#111827"
      },
      package: "app.rork.playbook",
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/endorsing1.png",
      name: "iEndorse",
      shortName: "iEndorse",
      description: "iEndorse - Build Your Endorsement List",
      themeColor: "#034466",
      backgroundColor: "#111827",
      display: "standalone",
      orientation: "portrait",
      startUrl: "/",
      scope: "/",
      lang: "en",
      dir: "ltr"
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "https://rork.com/"
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera",
          microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone",
          recordAudioAndroid: true
        }
      ],
      [
        "expo-location",
        {
          isAndroidForegroundServiceEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true,
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location."
        }
      ],
      [
        "expo-secure-store",
        {
          configureAndroidBackup: true,
          faceIDPermission: "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
