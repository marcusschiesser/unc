import { IconButton } from "../ui/button";
import { ErrorBoundary } from "../error";

import styles from "./bot.module.scss";

import AddIcon from "../../icons/add.svg";
import ChatIcon from "../../icons/chat.svg";
import CopyIcon from "../../icons/copy.svg";
import DeleteIcon from "../../icons/delete.svg";
import EditIcon from "../../icons/edit.svg";
import DeployIcon from "../../icons/lightning.svg";
import LinkedInIcon from "../../icons/linkedin.svg";
import SettingsIcon from "../../icons/settings.svg";
import ShareIcon from "../../icons/share.svg";
import MenuIcon from "../../icons/menu.svg";

import { useNavigate } from "react-router-dom";
import Locale, { ALL_LANG_OPTIONS, Lang } from "../../locales";
import { ModelConfig, useAppConfig, useChatStore } from "../../store";
import { DEFAULT_BOT_AVATAR, Bot as Bot, useBotStore } from "../../store/bot";
import { Avatar, AvatarPicker } from "../ui/emoji";
import {
  Dropdown,
  DropdownItemProps,
  List,
  ListItem,
  Modal,
  Popover,
  showConfirm,
} from "../ui/ui-lib";

import { useState } from "react";
import { LINKEDIN_URL, Path } from "../../constant";
import { BUILTIN_BOT_STORE } from "../../bots";
import { Updater } from "../../typing";
import { ContextPrompts } from "./context-prompt";
import { DeployConfig } from "../deploy/deploy";
import { ModelConfigList } from "./model-config";
import { Share } from "../share/share";
import { useSidebarContext } from "../home";

export function BotAvatar(props: { bot: Bot }) {
  return props.bot.avatar !== DEFAULT_BOT_AVATAR ? (
    <Avatar avatar={props.bot.avatar} />
  ) : (
    <Avatar model={props.bot.modelConfig.model} />
  );
}

export function BotConfig(props: {
  bot: Bot;
  updateBot: Updater<Bot>;
  extraListItems?: JSX.Element;
  readonly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const updateConfig = (updater: (config: ModelConfig) => void) => {
    if (props.readonly) return;

    const config = { ...props.bot.modelConfig };
    updater(config);
    props.updateBot((bot) => {
      bot.modelConfig = config;
      // if user changed current session bot, it will disable auto sync
      bot.syncGlobalConfig = false;
    });
  };

  const globalConfig = useAppConfig();

  return (
    <>
      <ContextPrompts
        context={props.bot.context}
        updateContext={(updater) => {
          const context = props.bot.context.slice();
          updater(context);
          props.updateBot((bot) => (bot.context = context));
        }}
      />

      <List>
        <ListItem title={Locale.Bot.Config.Avatar}>
          <Popover
            content={
              <AvatarPicker
                onEmojiClick={(emoji) => {
                  props.updateBot((bot) => (bot.avatar = emoji));
                  setShowPicker(false);
                }}
              ></AvatarPicker>
            }
            open={showPicker}
            onClose={() => setShowPicker(false)}
          >
            <div
              onClick={() => setShowPicker(true)}
              style={{ cursor: "pointer" }}
            >
              <BotAvatar bot={props.bot} />
            </div>
          </Popover>
        </ListItem>
        <ListItem title={Locale.Bot.Config.Name}>
          <input
            type="text"
            value={props.bot.name}
            onInput={(e) =>
              props.updateBot((bot) => {
                bot.name = e.currentTarget.value;
              })
            }
          ></input>
        </ListItem>
        <ListItem
          title={Locale.Bot.Config.HideContext.Title}
          subTitle={Locale.Bot.Config.HideContext.SubTitle}
        >
          <input
            type="checkbox"
            checked={props.bot.hideContext}
            onChange={(e) => {
              props.updateBot((bot) => {
                bot.hideContext = e.currentTarget.checked;
              });
            }}
          ></input>
        </ListItem>
        <ListItem
          title={Locale.Bot.Config.BotHello.Title}
          subTitle={Locale.Bot.Config.BotHello.SubTitle}
        >
          <input
            type="text"
            value={props.bot.botHello || ""}
            onChange={(e) => {
              props.updateBot((bot) => {
                bot.botHello = e.currentTarget.value;
              });
            }}
          ></input>
        </ListItem>
      </List>

      <List>
        <ModelConfigList
          modelConfig={{ ...props.bot.modelConfig }}
          updateConfig={updateConfig}
        />
        {props.extraListItems}
      </List>
    </>
  );
}

export function BotItem(props: { bot: Bot }) {
  const chatStore = useChatStore();
  const botStore = useBotStore();
  const navigate = useNavigate();
  const { setShowSidebar } = useSidebarContext();

  const [editingBotId, setEditingBotId] = useState<string | undefined>();
  const editingBot =
    botStore.get(editingBotId) ?? BUILTIN_BOT_STORE.get(editingBotId);
  const closeBotModal = () => setEditingBotId(undefined);

  const [deployBotId, setDeployBotId] = useState<string | undefined>();
  const deployBot =
    botStore.get(deployBotId) ?? BUILTIN_BOT_STORE.get(deployBotId);
  const closeDeployModal = () => setDeployBotId(undefined);

  const [shareBotId, setShareBotId] = useState<string | undefined>();
  const shareBot =
    botStore.get(shareBotId) ?? BUILTIN_BOT_STORE.get(shareBotId);
  const closeShareModal = () => setShareBotId(undefined);

  const ensureSession = () => {
    navigate(Path.Home);
    chatStore.ensureSession(props.bot);
    setShowSidebar(false);
  };

  const currentBotId = chatStore.currentSession().bot.id;
  const isActive = currentBotId === props.bot.id;

  const dropdownItems: DropdownItemProps[] = [
    {
      icon: <CopyIcon />,
      text: Locale.Bot.EditModal.Clone,
      action: () => {
        const newBot = botStore.create(props.bot, {
          reset: true,
        });
        newBot.name = `My ${props.bot.name}`;
      },
    },
    {
      icon: <EditIcon />,
      text: Locale.Bot.Item.Edit,
      action: () => setEditingBotId(props.bot.id),
      hidden: props.bot.builtin,
    },
    {
      icon: <DeleteIcon />,
      text: Locale.Bot.Item.Delete,
      action: async () => {
        if (await showConfirm(Locale.Bot.Item.DeleteConfirm)) {
          botStore.delete(props.bot.id);
        }
      },
      hidden: props.bot.builtin && !props.bot.share,
    },
    {
      icon: <DeployIcon />,
      text: Locale.Bot.Item.Deploy,
      action: () => setDeployBotId(props.bot.id),
      hidden: props.bot.builtin && !props.bot.share,
    },
    {
      icon: <ShareIcon />,
      text: Locale.Bot.Item.Share,
      action: () => setShareBotId(props.bot.id),
      hidden: props.bot.builtin,
    },
  ];

  return (
    <div
      className={
        styles["bot-item"] + ` ${isActive ? styles["bot-item-active"] : ""}`
      }
      key={props.bot.id}
    >
      <div className={styles["bot-header"]} onClick={ensureSession}>
        <div className={styles["bot-icon"]}>
          <BotAvatar bot={props.bot} />
        </div>
        <div className={styles["bot-title"]}>
          <div className={styles["bot-name"]}>{props.bot.name}</div>
        </div>
      </div>
      <div className={styles["bot-actions"]}>
        <Dropdown
          trigger={<IconButton icon={<MenuIcon />} />}
          items={dropdownItems}
        />
      </div>
      {deployBot && (
        <DeployConfig
          bot={deployBot}
          updateBot={(updater) => botStore.update(deployBotId!, updater)}
          onClose={closeDeployModal}
        />
      )}

      {shareBot && (
        <Share
          bot={shareBot}
          updateBot={(updater) => botStore.update(shareBotId!, updater)}
          onClose={closeShareModal}
        />
      )}

      {editingBot && (
        <div className="modal-bot">
          <Modal title={Locale.Bot.EditModal.Title} onClose={closeBotModal}>
            <BotConfig
              bot={editingBot}
              updateBot={(updater) => botStore.update(editingBotId!, updater)}
              readonly={editingBot.builtin}
            />
          </Modal>
        </div>
      )}
    </div>
  );
}

export function BotList() {
  const botStore = useBotStore();

  const allBots = botStore.getAll();

  const [searchBots, setSearchBots] = useState<Bot[]>([]);
  const [searchText, setSearchText] = useState("");
  const bots = searchText.length > 0 ? searchBots : allBots;

  // simple search, will refactor later
  const onSearch = (text: string) => {
    setSearchText(text);
    if (text.length > 0) {
      const result = allBots.filter((m) => m.name.includes(text));
      setSearchBots(result);
    } else {
      setSearchBots(allBots);
    }
  };

  return (
    <div className={styles["bot-page-body"]}>
      <div className={styles["bot-filter"]}>
        <IconButton
          className={styles["bot-create"]}
          icon={<AddIcon />}
          text={Locale.Bot.Page.Create}
          bordered
          onClick={() => {
            botStore.create();
          }}
        />
        <input
          type="text"
          className={styles["search-bar"]}
          placeholder={Locale.Bot.Page.Search(allBots.length)}
          autoFocus
          onInput={(e) => onSearch(e.currentTarget.value)}
        />
      </div>

      <div className={styles["bot-list"]}>
        {bots.map((m: Bot) => (
          <BotItem key={m.id} bot={m} />
        ))}
      </div>
    </div>
  );
}
