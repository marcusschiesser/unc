import { IconButton } from "../ui/button";

import AddIcon from "../../icons/add.svg";
import DeleteIcon from "../../icons/delete.svg";
import DragIcon from "../../icons/drag.svg";

import { ROLES } from "../../client/api";
import Locale from "../../locales";
import { ChatMessage, createMessage } from "../../store";
import { Input, Select } from "../ui/ui-lib";

import {
  DragDropContext,
  Draggable,
  Droppable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";
import { useState } from "react";
import { useQuery } from "react-query";
import { fetchSiteContent, isURL } from "../../utils/url";
import chatStyle from "./../chat/chat.module.scss";

interface PromptInputStatusProps {
  status: "loading" | "success" | "error";
  detail: string;
}

// drag and drop helper function
function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

function ContextPromptInputStatus(props: PromptInputStatusProps) {
  const className = chatStyle[`prompt-input-${props.status}`];
  return <div className={className}>{props.detail}</div>;
}

function ContextPromptItem(props: {
  index: number;
  prompt: ChatMessage;
  update: (prompt: ChatMessage) => void;
  remove: () => void;
}) {
  const [focusingInput, setFocusingInput] = useState(false);
  const requiredUrlInput = props.prompt.role === "URL";
  const currentInputValue = props.prompt.urlDetail
    ? props.prompt.urlDetail.url
    : props.prompt.content;
  const invalidUrlInput =
    !!currentInputValue && requiredUrlInput && !isURL(currentInputValue);
  const isFetchContentSuccess = requiredUrlInput && !!props.prompt.urlDetail;

  const { isLoading, error } = useQuery(
    ["content", currentInputValue],
    () => fetchSiteContent(currentInputValue),
    {
      enabled: requiredUrlInput && isURL(currentInputValue),
      refetchOnWindowFocus: false,
      retry: false,
      onSuccess: (urlDetail) => {
        props.update({
          ...props.prompt,
          content: urlDetail.content!,
          urlDetail,
        });
      },
    },
  );

  const handleUpdatePrompt = async (input: string) => {
    props.update({
      ...props.prompt,
      content: input,
      urlDetail: undefined,
    });
  };

  const getPromptInputStatus = (): PromptInputStatusProps | undefined => {
    if (invalidUrlInput) {
      return {
        status: "error",
        detail: "Please enter a valid URL",
      };
    }

    const errorMsg = (error as any)?.message;
    if (errorMsg) {
      return {
        status: "error",
        detail: errorMsg,
      };
    }

    if (isLoading) {
      return {
        status: "loading",
        detail: "Fetching site content...",
      };
    }

    if (isFetchContentSuccess) {
      return {
        status: "success",
        detail: "The URL has been successfully retrieved.",
      };
    }

    return undefined;
  };

  const promptInputStatus = getPromptInputStatus();

  return (
    <>
      {promptInputStatus && <ContextPromptInputStatus {...promptInputStatus} />}
      <div className={chatStyle["context-prompt-row"]}>
        {!focusingInput && (
          <>
            <div className={chatStyle["context-drag"]}>
              <DragIcon />
            </div>
            <Select
              value={props.prompt.role}
              className={chatStyle["context-role"]}
              onChange={(e) =>
                props.update({
                  ...props.prompt,
                  role: e.target.value as any,
                })
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </>
        )}
        <Input
          value={currentInputValue}
          type="text"
          className={chatStyle["context-content"]}
          rows={focusingInput ? 5 : 1}
          onFocus={() => setFocusingInput(true)}
          onBlur={() => {
            setFocusingInput(false);
            // If the selection is not removed when the user loses focus, some
            // extensions like "Translate" will always display a floating bar
            window?.getSelection()?.removeAllRanges();
          }}
          onInput={(e) => handleUpdatePrompt(e.currentTarget.value)}
        />
        {!focusingInput && (
          <IconButton
            icon={<DeleteIcon />}
            className={chatStyle["context-delete-button"]}
            onClick={() => props.remove()}
            bordered
          />
        )}
      </div>
    </>
  );
}

export function ContextPrompts(props: {
  context: ChatMessage[];
  updateContext: (updater: (context: ChatMessage[]) => void) => void;
}) {
  const context = props.context;

  const addContextPrompt = (prompt: ChatMessage, i: number) => {
    props.updateContext((context) => context.splice(i, 0, prompt));
  };

  const removeContextPrompt = (i: number) => {
    props.updateContext((context) => context.splice(i, 1));
  };

  const updateContextPrompt = (i: number, prompt: ChatMessage) => {
    props.updateContext((context) => (context[i] = prompt));
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) {
      return;
    }
    const newContext = reorder(
      context,
      result.source.index,
      result.destination.index,
    );
    props.updateContext((context) => {
      context.splice(0, context.length, ...newContext);
    });
  };

  return (
    <>
      <div className={chatStyle["context-prompt"]} style={{ marginBottom: 20 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="context-prompt-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {context.map((c, i) => (
                  <Draggable
                    draggableId={c.id || i.toString()}
                    index={i}
                    key={c.id}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <ContextPromptItem
                          index={i}
                          prompt={c}
                          update={(prompt) => updateContextPrompt(i, prompt)}
                          remove={() => removeContextPrompt(i)}
                        />
                        <div
                          className={chatStyle["context-prompt-insert"]}
                          onClick={() => {
                            addContextPrompt(
                              createMessage({
                                role: "user",
                                content: "",
                                date: new Date().toLocaleString(),
                              }),
                              i + 1,
                            );
                          }}
                        >
                          <AddIcon />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {props.context.length === 0 && (
          <div className={chatStyle["context-prompt-row"]}>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Context.Add}
              bordered
              className={chatStyle["context-prompt-button"]}
              onClick={() =>
                addContextPrompt(
                  createMessage({
                    role: "user",
                    content: "",
                    date: "",
                  }),
                  props.context.length,
                )
              }
            />
          </div>
        )}
      </div>
    </>
  );
}
