import { Share, Bot } from "@/app/store/bot";
import Locale from "../../locales";
import { List, ListItem, Modal, PasswordInput, showToast } from "../ui/ui-lib";
import styles from "./share.module.scss";

import { useEffect, useState } from "react";

import CopyIcon from "../../icons/copy.svg";
import LoadingIcon from "../../icons/three-dots.svg";

import { Updater } from "@/app/typing";
import { copyToClipboard } from "@/app/utils";
import { useMutation } from "react-query";
import { IconButton } from "../ui/button";
import { ShareResponse } from "@/app/api/share/route";

async function share(bot: Bot): Promise<ShareResponse> {
  const res = await fetch("/api/share", {
    method: "POST",
    body: JSON.stringify({ bot: bot }),
  });
  const json = await res.json();
  console.log("[Share]", json);
  if (!res.ok) {
    throw new Error(json.msg);
  }
  return json;
}

async function patch(share: Share): Promise<void> {
  if (!share.id) {
    throw new Error("Can't patch without share id being set.");
  }
  const res = await fetch(`/api/share/${share.id}`, {
    method: "PATCH",
    body: JSON.stringify({ shareToken: share.token }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.msg);
  }
}

export function Share(props: {
  bot: Bot;
  updateBot: Updater<Bot>;
  onClose: () => void;
}) {
  const [showToken, setShowToken] = useState(
    props.bot.share?.token ? true : false,
  );
  const [token, setToken] = useState(props.bot.share?.token || "");

  const shareMutation = useMutation(share, {
    onSuccess: (data) => {
      props.updateBot((bot) => {
        bot.share = { ...bot.share, id: data.key };
      });
    },
  });
  const patchMutation = useMutation(patch);

  useEffect(() => {
    shareMutation.mutate(props.bot);
  }, []);

  const onClose = () => {
    const newToken = showToken ? token : undefined;
    if (props.bot.share && newToken !== props.bot.share.token) {
      // token got changed, update it locally
      const newShare = { ...props.bot.share!, token: newToken };
      props.updateBot((bot) => {
        bot.share = newShare;
      });
      // and on the server side if a key was generated
      if (shareMutation.data) {
        setTimeout(() => {
          patchMutation.mutate(newShare, {
            onError: () => {
              showToast(Locale.Share.Token.Error);
            },
          });
        }, 0);
      }
    }
    props.onClose();
  };

  return (
    <div className="modal-bot">
      <Modal
        title={Locale.Share.Title}
        onClose={onClose}
        actions={[
          shareMutation.error ? (
            <span className={styles["error"]}>{Locale.Share.Url.Error}</span>
          ) : (
            <div key="hint" className="hint">
              {Locale.Share.Url.Hint}
            </div>
          ),
        ]}
      >
        {!shareMutation.error && (
          <List>
            <ListItem title={Locale.Share.Url.Title}>
              {shareMutation.data ? (
                <div className={styles["share-url"]}>
                  <input type="text" value={shareMutation.data.url} readOnly />
                  <IconButton
                    icon={<CopyIcon />}
                    onClick={() => copyToClipboard(shareMutation.data.url)}
                  />
                </div>
              ) : (
                <LoadingIcon />
              )}
            </ListItem>
            {props.bot.share && (
              <>
                <ListItem
                  title={Locale.Share.ShowToken.Title}
                  subTitle={Locale.Share.ShowToken.SubTitle}
                >
                  <input
                    type="checkbox"
                    checked={showToken}
                    onChange={(e) => setShowToken(!showToken)}
                  ></input>
                </ListItem>
                {showToken && (
                  <ListItem
                    title={Locale.Share.Token.Title}
                    subTitle={Locale.Share.Token.SubTitle}
                  >
                    <PasswordInput
                      value={token}
                      type="text"
                      placeholder={Locale.Settings.Token.Placeholder}
                      onChange={(e) => {
                        setToken(e.currentTarget.value);
                      }}
                    />
                  </ListItem>
                )}
              </>
            )}
          </List>
        )}
      </Modal>
    </div>
  );
}
