import { useChatStore } from "../../store";
import Locale from "../../locales";
import styles from "./chat.module.scss";

export function ClearContextDivider() {
  const chatStore = useChatStore();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateCurrentSession(
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}
