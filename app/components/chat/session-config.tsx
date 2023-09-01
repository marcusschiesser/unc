import Locale from "../../locales";
import { useChatStore } from "../../store";
import { useBotStore } from "../../store/bot";
import { BotConfig } from "../bot/bot";
import { ListItem, Modal } from "../ui-lib";

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const botStore = useBotStore();

  return (
    <div className="modal-bot">
      <Modal title={Locale.Bot.EditModal.Title} onClose={() => props.onClose()}>
        <BotConfig
          bot={session.bot}
          updateBot={(updater) => {
            // update bot in bot store and session
            botStore.update(session.bot.id, updater);
            const updatedBot = botStore.get(session.bot.id);
            if (updatedBot) {
              chatStore.updateCurrentSession(
                (session) => (session.bot = updatedBot),
              );
            }
          }}
          extraListItems={
            session.bot.modelConfig.sendMemory ? (
              <ListItem
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></BotConfig>
      </Modal>
    </div>
  );
}
