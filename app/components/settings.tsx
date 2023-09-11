import { useEffect, useState } from "react";

import styles from "./settings.module.scss";

import CloseIcon from "../icons/close.svg";
import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import {
  List,
  ListItem,
  PasswordInput,
  Popover,
  Select,
  showConfirm,
  showToast,
} from "./ui/ui-lib";

import {
  SubmitKey,
  Theme,
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "../store";
import { IconButton } from "./ui/button";

import { useNavigate } from "react-router-dom";
import { FileName, Path } from "../constant";
import Locale from "../locales";
import { useBotStore } from "../store/bot";
import { downloadAs, readFromFile } from "../utils";
import { Avatar, AvatarPicker } from "./ui/emoji";
import { ErrorBoundary } from "./error";
import { InputRange } from "./ui/input-range";
import { getClientConfig } from "../config/client";

function DangerItems() {
  const chatStore = useChatStore();
  const appConfig = useAppConfig();

  return (
    <List>
      <ListItem
        title={Locale.Settings.Danger.Reset.Title}
        subTitle={Locale.Settings.Danger.Reset.SubTitle}
      >
        <IconButton
          text={Locale.Settings.Danger.Reset.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Reset.Confirm)) {
              appConfig.reset();
            }
          }}
          type="danger"
        />
      </ListItem>
      <ListItem
        title={Locale.Settings.Danger.Clear.Title}
        subTitle={Locale.Settings.Danger.Clear.SubTitle}
      >
        <IconButton
          text={Locale.Settings.Danger.Clear.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Clear.Confirm)) {
              chatStore.clearAllData();
            }
          }}
          type="danger"
        />
      </ListItem>
    </List>
  );
}

function BackupItems() {
  const botStore = useBotStore();

  const backupBots = () => {
    downloadAs(JSON.stringify(botStore.backup()), FileName.Bots);
  };

  const restoreBots = async () => {
    try {
      const content = await readFromFile();
      const importBots = JSON.parse(content);
      botStore.restore(importBots);
      showToast(Locale.Settings.Backup.Upload.Success);
    } catch (err) {
      console.error("[Restore] ", err);
      showToast(Locale.Settings.Backup.Upload.Failed((err as Error).message));
    }
  };

  return (
    <List>
      <ListItem
        title={Locale.Settings.Backup.Download.Title}
        subTitle={Locale.Settings.Backup.Download.SutTitle}
      >
        <IconButton icon={<DownloadIcon />} bordered onClick={backupBots} />
      </ListItem>
      <ListItem
        title={Locale.Settings.Backup.Upload.Title}
        subTitle={Locale.Settings.Backup.Upload.SutTitle}
      >
        <IconButton icon={<UploadIcon />} bordered onClick={restoreBots} />
      </ListItem>
    </List>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const config = useAppConfig();
  const updateConfig = config.update;
  const clientConfig = getClientConfig();

  const accessStore = useAccessStore();

  useEffect(() => {
    const keydownEvent = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate(Path.Home);
      }
    };
    document.addEventListener("keydown", keydownEvent);
    return () => {
      document.removeEventListener("keydown", keydownEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">
            {Locale.Settings.Title}
          </div>
          <div className="window-header-sub-title">
            {Locale.Settings.SubTitle}
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button"></div>
          <div className="window-action-button"></div>
          <div className="window-action-button">
            <IconButton
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Home)}
              bordered
            />
          </div>
        </div>
      </div>
      <div className={styles["settings"]}>
        <List>
          <ListItem title={Locale.Settings.Avatar}>
            <Popover
              onClose={() => setShowEmojiPicker(false)}
              content={
                <AvatarPicker
                  onEmojiClick={(avatar: string) => {
                    updateConfig((config) => (config.avatar = avatar));
                    setShowEmojiPicker(false);
                  }}
                />
              }
              open={showEmojiPicker}
            >
              <div
                className={styles.avatar}
                onClick={() => setShowEmojiPicker(true)}
              >
                <Avatar avatar={config.avatar} />
              </div>
            </Popover>
          </ListItem>

          <ListItem title={Locale.Settings.SendKey}>
            <Select
              value={config.submitKey}
              onChange={(e) => {
                updateConfig(
                  (config) =>
                    (config.submitKey = e.target.value as any as SubmitKey),
                );
              }}
            >
              {Object.values(SubmitKey).map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem title={Locale.Settings.Theme}>
            <Select
              value={config.theme}
              onChange={(e) => {
                updateConfig(
                  (config) => (config.theme = e.target.value as any as Theme),
                );
              }}
            >
              {Object.values(Theme).map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </Select>
          </ListItem>

          <ListItem
            title={Locale.Settings.FontSize.Title}
            subTitle={Locale.Settings.FontSize.SubTitle}
          >
            <InputRange
              title={`${config.fontSize ?? 14}px`}
              value={config.fontSize}
              min="12"
              max="18"
              step="1"
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.fontSize = Number.parseInt(e.currentTarget.value)),
                )
              }
            ></InputRange>
          </ListItem>
        </List>

        {!clientConfig.hasServerApiKey && (
          <List>
            <ListItem
              title={Locale.Settings.Token.Title}
              subTitle={Locale.Settings.Token.SubTitle}
            >
              <PasswordInput
                value={accessStore.token}
                type="text"
                placeholder={Locale.Settings.Token.Placeholder}
                onChange={(e) => {
                  accessStore.updateToken(e.currentTarget.value);
                }}
              />
            </ListItem>
          </List>
        )}

        <BackupItems />
        <DangerItems />
      </div>
    </ErrorBoundary>
  );
}
