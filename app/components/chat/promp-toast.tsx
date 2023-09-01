import BrainIcon from "../../icons/brain.svg";
import Locale from "../../locales";
import { useChatStore } from "../../store";
import styles from "./chat.module.scss";
import { SessionConfigModel } from "./session-config";

export function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.bot.context;

  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
      {props.showToast && !session.bot.builtin && (
        <div
          className={styles["prompt-toast-inner"] + " clickable"}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={styles["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}
