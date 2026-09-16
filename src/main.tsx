/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import App from "./App.tsx";

/*
 * The service worker is for the website: it is what makes the browser version
 * installable and playable offline. Inside the Android app it has no job - the
 * whole game already ships in the APK - and it would do harm, because it keeps
 * serving whatever bundle it cached. After an app update the new build would
 * sit on the device while the worker went on handing out the old one.
 */
if (!Capacitor.isNativePlatform()) {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
