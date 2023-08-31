"use client";

require("../polyfill");

import React, { useContext, useEffect, useState } from "react";

import { QueryClient, QueryClientProvider } from "react-query";
import styles from "./home.module.scss";

import LoadingIcon from "../icons/three-dots.svg";

import { getCSSVar, useMobileScreen } from "../utils";

import dynamic from "next/dynamic";
import { Path, SlotID } from "../constant";
import { ErrorBoundary } from "./error";

import { getLang } from "../locales";

import {
  Route,
  HashRouter as Router,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { getClientConfig } from "../config/client";
import { useChatStore } from "../store";
import { useAppConfig } from "../store/config";
import { Bot, useBotStore } from "../store/bot";
import { SideBar } from "./sidebar";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={styles["loading-content"] + " no-dark"}>
      {!props.noLogo && <p>Loading your AI bots</p>}
      <LoadingIcon />
    </div>
  );
}

const SettingsPage = dynamic(
  async () => (await import("./settings")).Settings,
  {
    loading: () => <Loading noLogo />,
  },
);

const ChatPage = dynamic(async () => (await import("./chat")).Chat, {
  loading: () => <Loading noLogo />,
});

export function useSwitchTheme() {
  const config = useAppConfig();

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = () => {
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  const googleFontUrl =
    getClientConfig()?.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
  linkEl.rel = "stylesheet";
  linkEl.href =
    googleFontUrl + "/css2?family=Noto+Sans:wght@300;400;700;900&display=swap";
  document.head.appendChild(linkEl);
};

// if a bot is passed this HOC ensures that the bot is added to the store
// and that the user can directly have a chat session with it
function withBot(Component: React.FunctionComponent, bot?: Bot) {
  return function WithBotComponent() {
    const [botInitialized, setBotInitialized] = useState(false);
    const navigate = useNavigate();
    const botStore = useBotStore();
    const chatStore = useChatStore();
    if (bot && !botInitialized) {
      if (!bot.share?.id) {
        throw new Error("bot must have a shared id");
      }
      // ensure that bot for the same share id is not created a 2nd time
      let sharedBot = botStore.getByShareId(bot.share?.id);
      if (!sharedBot) {
        sharedBot = botStore.create(bot, { readOnly: true });
      }
      // let the user directly chat with the bot
      chatStore.ensureSession(sharedBot);
      setTimeout(() => {
        // redirect to chat - use history API to clear URL
        history.pushState({}, "", "/");
        navigate(Path.Chat);
      }, 1);
      setBotInitialized(true);
      return <Loading />;
    }

    return <Component />;
  };
}

const SidebarContext = React.createContext<{
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
} | null>(null);

function SidebarContextProvider(props: { children: React.ReactNode }) {
  const [showSidebar, setShowSidebar] = useState(true);
  return (
    <SidebarContext.Provider value={{ showSidebar, setShowSidebar }}>
      {props.children}
    </SidebarContext.Provider>
  );
}

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error(
      "useSidebarContext must be used within an SidebarContextProvider",
    );
  }
  return context;
};

function Screen() {
  const config = useAppConfig();
  const location = useLocation();
  const isMobileScreen = useMobileScreen();
  const { showSidebar } = useSidebarContext();
  const isHome = location.pathname === Path.Home;

  const showSidebarOnMobile = showSidebar || !isMobileScreen;

  useEffect(() => {
    loadAsyncGoogleFont();
  }, []);

  return (
    <div
      className={
        styles.container +
        ` ${
          config.tightBorder && !isMobileScreen
            ? styles["tight-container"]
            : styles.container
        }`
      }
    >
      {
        <>
          {showSidebarOnMobile && (
            <SideBar className={isHome ? styles["sidebar-show"] : ""} />
          )}
          <div className={styles["window-content"]} id={SlotID.AppBody}>
            <Routes>
              <Route path={Path.Chat} element={<ChatPage />} />
              <Route path={Path.Settings} element={<SettingsPage />} />
            </Routes>
          </div>
        </>
      }
    </div>
  );
}

export function Home({ bot }: { bot?: Bot }) {
  useSwitchTheme();
  useHtmlLang();

  useEffect(() => {
    console.log("[Config] got config from build time", getClientConfig());
  }, []);

  if (!useHasHydrated()) {
    return <Loading />;
  }

  const BotScreen = withBot(Screen, bot);
  const queryClient = new QueryClient();

  return (
    <ErrorBoundary>
      <Router>
        <QueryClientProvider client={queryClient}>
          <SidebarContextProvider>
            <BotScreen />
          </SidebarContextProvider>
        </QueryClientProvider>
      </Router>
    </ErrorBoundary>
  );
}
