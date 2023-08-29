import { Path } from "../constant";
import { IconButton } from "./button";
import styles from "./welcome.module.scss";

import LightningIcon from "../icons/lightning.svg";
import BotIcon from "../icons/bot.svg";

import { useNavigate } from "react-router-dom";
import Locale from "../locales";
import { MarkdownContent } from "./markdown";
import { useAppConfig } from "../store";

export function WelcomePage() {
  const config = useAppConfig();
  const navigate = useNavigate();

  const start = function () {
    config.update((config) => (config.showWelcomePage = false));
    navigate(Path.Home);
  };

  return (
    <div className={styles["welcome-page"]}>
      <div className={`no-dark ${styles["logo"]}`}>
        <BotIcon />
      </div>

      <div className={styles["title"]}>{Locale.Welcome.Title}</div>
      <div className={styles["sub-title"]}>{Locale.Welcome.SubTitle}</div>

      <div className={styles["message"]}>{Locale.Welcome.Message}</div>

      <div className={styles["items"]}>
        <MarkdownContent content={Locale.Welcome.Items} />
      </div>

      <div className={styles["actions"]}>
        <IconButton
          text={Locale.Welcome.Start}
          onClick={start}
          icon={<LightningIcon />}
          type="primary"
          shadow
        />
      </div>
    </div>
  );
}
