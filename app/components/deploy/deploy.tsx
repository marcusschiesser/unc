import { Bot } from "@/app/store/bot";
import { List, ListItem, Modal } from "../ui-lib";
import { Updater } from "@/app/typing";
import Locale from "../../locales";
import { DEFAULT_DEPLOYMENT, Deployment } from "@/app/store/deployment";
import { IconButton } from "../button";
import StartIcon from "../../icons/lightning.svg";
import StopIcon from "../../icons/cancel.svg";
import LoadingIcon from "../../icons/three-dots.svg";

import { useWorkerStore } from "@/app/store/workers";
import { useEffect, useState } from "react";
import { useAccessStore } from "@/app/store";
import { getClientConfig } from "@/app/config/client";

enum Status {
  Stopped = "STOPPED",
  Starting = "STARTING",
  Stopping = "STOPPING",
  Running = "RUNNING",
  InvalidToken = "INVALID_TOKEN",
  Unknown = "UNKNOWN",
}

export function DeployConfig(props: {
  bot: Bot;
  updateBot: Updater<Bot>;
  onClose?: () => void;
}) {
  const [status, setStatus] = useState(Status.Stopped);
  const workerStore = useWorkerStore();
  const accessStore = useAccessStore.getState();
  const deployment = props.bot.deployment || DEFAULT_DEPLOYMENT;
  const updateConfig = (updater: (config: Deployment) => void) => {
    const config = { ...deployment };
    updater(config);
    props.updateBot((bot) => {
      bot.deployment = config;
    });
  };
  const worker = deployment.worker_id
    ? workerStore.get(deployment.worker_id)
    : null;

  useEffect(() => {
    // set status from worker and setup message callback
    // from worker
    if (worker) {
      worker.onmessage = function (event) {
        // Handle the received message here
        const status: Status = event.data.status;
        if (status === Status.Unknown) {
          setStatus(event.data.error ?? Status.Unknown);
        } else {
          setStatus(status);
        }
      };
      // if worker already exists, ask it of its last status, if we don't receive a message
      // we assume that the worker is already stopped (which is ok as the default status is 'stopped')
      worker.postMessage({ command: "get_status" });
    }
  }, [worker]);

  const startBot = () => {
    const worker = new Worker(
      new URL("../../workers/telegram.ts", import.meta.url),
    );
    const id = workerStore.create(worker);
    const config = getClientConfig();
    worker.postMessage({
      command: "start",
      data: {
        token: deployment.token,
        openaiToken: accessStore.token,
        bot: props.bot,
        config,
      },
    });
    updateConfig((config) => (config.worker_id = id));
  };

  const stopBot = () => {
    if (worker) {
      worker.postMessage({ command: "stop" });
      workerStore.delete(deployment.worker_id!);
      updateConfig((config) => (config.worker_id = null));
    }
  };

  const renderStatus = (status: Status | string) => {
    switch (status) {
      case Status.Stopped:
        return "Bot not running.";
      case Status.Starting:
      case Status.Stopping:
        return <LoadingIcon />;
      case Status.Running:
        return "Bot running.";
      case Status.InvalidToken:
        status = "Invalid Telegram bot token. Please check.";
      default:
        return <span style={{ color: "red" }}>{status}</span>;
    }
  };

  return (
    <div className="modal-bot">
      <Modal
        title={Locale.Deploy.Config.Title}
        onClose={props.onClose}
        actions={[
          <div key="status" className="status">
            {renderStatus(status)}
          </div>,
          <IconButton
            icon={<StartIcon />}
            text={Locale.Deploy.Config.Start}
            key="start"
            bordered
            disabled={
              status === Status.Running ||
              status === Status.Starting ||
              status === Status.Stopping
            }
            onClick={startBot}
          />,
          <IconButton
            icon={<StopIcon />}
            text={Locale.Deploy.Config.Stop}
            key="stop"
            bordered
            disabled={status !== Status.Running}
            onClick={stopBot}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Deploy.Config.Token.Title}
            subTitle={
              <>
                {Locale.Deploy.Config.Token.Hint}&nbsp;
                <a href="https://t.me/BotFather" target="_blank">
                  https://t.me/BotFather
                </a>
              </>
            }
          >
            <input
              type="text"
              value={props.bot.deployment?.token}
              placeholder={Locale.Deploy.Config.Token.Placeholder}
              onInput={(e) =>
                updateConfig((config) => (config.token = e.currentTarget.value))
              }
            />
          </ListItem>
        </List>
      </Modal>
    </div>
  );
}
