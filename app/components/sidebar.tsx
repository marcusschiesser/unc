import { useEffect, useRef } from "react";

import styles from "./home.module.scss";

import CloseIcon from "../icons/close.svg";
import LinkedInIcon from "../icons/linkedin.svg";
import SettingsIcon from "../icons/settings.svg";
import { IconButton } from "./button";

import Locale from "../locales";

import { useAppConfig, useChatStore } from "../store";

import {
  LINKEDIN_URL,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
} from "../constant";

import dynamic from "next/dynamic";
import { Link, useNavigate } from "react-router-dom";
import { useMobileScreen } from "../utils";
import { showConfirm } from "./ui-lib";

const BotList = dynamic(async () => (await import("./bot/bot")).BotList, {
  loading: () => null,
});

function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? 300);
  const lastUpdateTime = useRef(Date.now());

  const handleMouseMove = useRef((e: MouseEvent) => {
    if (Date.now() < lastUpdateTime.current + 50) {
      return;
    }
    lastUpdateTime.current = Date.now();
    const d = e.clientX - startX.current;
    const nextWidth = limit(startDragWidth.current + d);
    config.update((config) => (config.sidebarWidth = nextWidth));
  });

  const handleMouseUp = useRef(() => {
    startDragWidth.current = config.sidebarWidth ?? 300;
    window.removeEventListener("mousemove", handleMouseMove.current);
    window.removeEventListener("mouseup", handleMouseUp.current);
  });

  const onDragMouseDown = (e: MouseEvent) => {
    startX.current = e.clientX;

    window.addEventListener("mousemove", handleMouseMove.current);
    window.addEventListener("mouseup", handleMouseUp.current);
  };
  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? 300);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragMouseDown,
    shouldNarrow,
  };
}

export function SideBar(props: { className?: string }) {
  const chatStore = useChatStore();

  // drag side bar
  const { onDragMouseDown, shouldNarrow } = useDragSideBar();
  const navigate = useNavigate();

  return (
    <div
      className={`${styles.sidebar} ${props.className} ${
        shouldNarrow && styles["narrow-sidebar"]
      }`}
    >
      <div className={styles["sidebar-header"]} data-tauri-drag-region>
        <div className={styles["sidebar-title"]} data-tauri-drag-region>
          {Locale.Welcome.Title}
        </div>
        <div className={styles["sidebar-sub-title"]}>
          {Locale.Welcome.SubTitle}
        </div>
      </div>

      <div
        className={styles["sidebar-body"]}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate(Path.Home);
          }
        }}
      >
        <BotList />
      </div>

      <div className={styles["sidebar-tail"]}>
        <div className={styles["sidebar-actions"]}>
          <div className={styles["sidebar-action"]}>
            <Link to={Path.Settings}>
              <IconButton icon={<SettingsIcon />} shadow />
            </Link>
          </div>
        </div>
        <div>
          <IconButton
            icon={<LinkedInIcon />}
            text={shouldNarrow ? undefined : Locale.Home.LinkedIn}
            onClick={() => window.open(LINKEDIN_URL, "_blank")}
          />
        </div>
      </div>

      <div
        className={styles["sidebar-drag"]}
        onMouseDown={(e) => onDragMouseDown(e as any)}
      ></div>
    </div>
  );
}
