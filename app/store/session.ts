import { nanoid } from "nanoid";
import { LLMConfig, RequestMessage, api } from "../client/api";
import { ChatControllerPool } from "../client/controller";
import { DEFAULT_INPUT_TEMPLATE, DEFAULT_SYSTEM_TEMPLATE } from "../constant";
import Locale, { getLang } from "../locales";
import { trimTopic } from "../utils";
import { prettyObject } from "../utils/format";
import { estimateTokenLength } from "../utils/token";
import { fetchSiteContent, isURL } from "../utils/url";
import { ModelConfig, ModelType } from "./config";
import { Bot, createEmptyBot } from "./bot";

export const DEFAULT_TOPIC = Locale.Store.DefaultTopic;

export type URLDetail = {
  url: string;
  size: number;
  type: "text/html" | "application/pdf";
};

export type URLDetailContent = URLDetail & {
  content?: string;
};

export type ChatMessage = RequestMessage & {
  date: string;
  streaming?: boolean;
  isError?: boolean;
  errorMsg?: string;
  id: string;
  model?: ModelType;
  urlDetail?: URLDetail;
};

export function createMessage(override: Partial<ChatMessage>): ChatMessage {
  return {
    id: nanoid(),
    date: new Date().toLocaleString(),
    role: "user",
    content: "",
    ...override,
  };
}

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: string;
  topic: string;

  memoryPrompt: string;
  messages: ChatMessage[];
  stat: ChatStat;
  lastUpdate: number;
  lastSummarizeIndex: number;
  clearContextIndex?: number;

  bot: Bot;
}

export function createEmptySession(bot?: Bot): ChatSession {
  return {
    id: nanoid(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,

    bot: bot ?? createEmptyBot(),
  };
}

function fillTemplateWith(input: string, modelConfig: ModelConfig) {
  const vars = {
    model: modelConfig.model,
    time: new Date().toLocaleString(),
    lang: getLang(),
    input: input,
  };

  let output = modelConfig.template ?? DEFAULT_INPUT_TEMPLATE;

  // must contains {{input}}
  const inputVar = "{{input}}";
  if (!output.includes(inputVar)) {
    output += "\n" + inputVar;
  }

  Object.entries(vars).forEach(([name, value]) => {
    output = output.replaceAll(`{{${name}}}`, value);
  });

  return output;
}

async function createUserMessage(
  content: string,
  modelConfig: ModelConfig,
): Promise<ChatMessage> {
  if (isURL(content)) {
    const urlDetail = await fetchSiteContent(content);
    const userContent = urlDetail.content;
    delete urlDetail["content"]; // clean content in url detail as we already store it in the message
    console.log("[User Input] did get url detail: ", urlDetail, userContent);
    return createMessage({
      role: "user",
      content: userContent,
      urlDetail,
    });
  } else {
    const userContent = fillTemplateWith(content, modelConfig);
    console.log("[User Input] after template: ", userContent);

    return createMessage({
      role: "user",
      content: userContent,
    });
  }
}

function transformUserMessageForSending(
  userMessage: ChatMessage,
): RequestMessage {
  const { content, urlDetail } = userMessage;
  if (!urlDetail) return userMessage;
  // if the user sends a URL message, let the LLM summarize the content of the URL
  return {
    role: userMessage.role,
    content: `Summarize the following text briefly in 200 words or less:\n\n${content}`,
  };
}

function transformAssistantMessageForSending(
  message: ChatMessage,
): RequestMessage {
  const { content } = message;
  // messages with role URL are assistant messages that contain a URL - the content is already retrieved by context-prompt.tsx
  if (message.role !== "URL") return message;
  return {
    role: "assistant",
    content,
  };
}

function getMemoryPrompt(session: ChatSession) {
  return {
    role: "system",
    content:
      session.memoryPrompt.length > 0
        ? Locale.Store.Prompt.History(session.memoryPrompt)
        : "",
    date: "",
  } as ChatMessage;
}

function getMessagesWithMemory(session: ChatSession) {
  const modelConfig = session.bot.modelConfig;
  const clearContextIndex = session.clearContextIndex ?? 0;
  const messages = session.messages.slice();
  const totalMessageCount = session.messages.length;

  // in-context prompts
  const contextPrompts = session.bot.context.slice();

  // system prompts, to get close to OpenAI Web ChatGPT
  // only will be injected if user does not use a bot or set none context prompts
  const shouldInjectSystemPrompts = contextPrompts.length === 0;
  const systemPrompts = shouldInjectSystemPrompts
    ? [
        createMessage({
          role: "system",
          content: fillTemplateWith("", {
            ...modelConfig,
            template: DEFAULT_SYSTEM_TEMPLATE,
          }),
        }),
      ]
    : [];
  if (shouldInjectSystemPrompts) {
    console.log(
      "[Global System Prompt] ",
      systemPrompts.at(0)?.content ?? "empty",
    );
  }

  // long term memory
  const shouldSendLongTermMemory =
    modelConfig.sendMemory &&
    session.memoryPrompt &&
    session.memoryPrompt.length > 0 &&
    session.lastSummarizeIndex > clearContextIndex;
  const longTermMemoryPrompts = shouldSendLongTermMemory
    ? [getMemoryPrompt(session)]
    : [];
  const longTermMemoryStartIndex = session.lastSummarizeIndex;

  // short term memory
  const shortTermMemoryStartIndex = Math.max(
    0,
    totalMessageCount - modelConfig.historyMessageCount,
  );

  // lets concat send messages, including 4 parts:
  // 0. system prompt: to get close to OpenAI Web ChatGPT
  // 1. long term memory: summarized memory messages
  // 2. pre-defined in-context prompts
  // 3. short term memory: latest n messages
  // 4. newest input message
  const memoryStartIndex = shouldSendLongTermMemory
    ? Math.min(longTermMemoryStartIndex, shortTermMemoryStartIndex)
    : shortTermMemoryStartIndex;
  // and if user has cleared history messages, we should exclude the memory too.
  const contextStartIndex = Math.max(clearContextIndex, memoryStartIndex);
  const maxTokenThreshold = modelConfig.max_tokens;

  // get recent messages as much as possible
  const reversedRecentMessages = [];
  for (
    let i = totalMessageCount - 1, tokenCount = 0;
    i >= contextStartIndex && tokenCount < maxTokenThreshold;
    i -= 1
  ) {
    const msg = messages[i];
    if (!msg || msg.isError) continue;
    tokenCount += estimateTokenLength(msg.content);
    reversedRecentMessages.push(msg);
  }

  // concat all messages
  const recentMessages = [
    ...systemPrompts,
    ...longTermMemoryPrompts,
    ...contextPrompts,
    ...reversedRecentMessages.reverse(),
  ];

  return recentMessages;
}

function countMessages(msgs: ChatMessage[]) {
  return msgs.reduce((pre, cur) => pre + estimateTokenLength(cur.content), 0);
}

function summarizeSession(
  session: ChatSession,
  accessToken: string,
  llmConfig: LLMConfig,
  callbacks: {
    onUpdateTopic: (topic: string) => void;
  },
) {
  // remove error messages if any
  const messages = session.messages;

  // should summarize topic after chating more than 50 words
  const SUMMARIZE_MIN_LEN = 50;
  if (
    session.topic === DEFAULT_TOPIC &&
    countMessages(messages) >= SUMMARIZE_MIN_LEN
  ) {
    const topicMessages = messages.concat(
      createMessage({
        role: "user",
        content: Locale.Store.Prompt.Topic,
      }),
    );
    api.llm.chat({
      messages: topicMessages,
      share: session.bot.share,
      token: accessToken,
      config: {
        ...llmConfig,
        model: "gpt-3.5-turbo",
      },
      onFinish(message) {
        callbacks.onUpdateTopic(
          message.length > 0 ? trimTopic(message) : DEFAULT_TOPIC,
        );
      },
    });
  }

  const modelConfig = session.bot.modelConfig;
  const summarizeIndex = Math.max(
    session.lastSummarizeIndex,
    session.clearContextIndex ?? 0,
  );
  let toBeSummarizedMsgs = messages
    .filter((msg) => !msg.isError)
    .slice(summarizeIndex);

  const historyMsgLength = countMessages(toBeSummarizedMsgs);

  if (historyMsgLength > modelConfig?.max_tokens ?? 4000) {
    const n = toBeSummarizedMsgs.length;
    toBeSummarizedMsgs = toBeSummarizedMsgs.slice(
      Math.max(0, n - modelConfig.historyMessageCount),
    );
  }

  // add memory prompt
  toBeSummarizedMsgs.unshift(getMemoryPrompt(session));

  const lastSummarizeIndex = session.messages.length;

  console.log(
    "[Chat History] ",
    toBeSummarizedMsgs,
    historyMsgLength,
    modelConfig.compressMessageLengthThreshold,
  );

  if (
    historyMsgLength > modelConfig.compressMessageLengthThreshold &&
    modelConfig.sendMemory
  ) {
    api.llm.chat({
      messages: toBeSummarizedMsgs.concat(
        createMessage({
          role: "system",
          content: Locale.Store.Prompt.Summarize,
          date: "",
        }),
      ),
      share: session.bot.share,
      config: { ...modelConfig, stream: true, model: "gpt-3.5-turbo" },
      token: accessToken,
      onUpdate(message) {
        session.memoryPrompt = message;
      },
      onFinish(message) {
        console.log("[Memory] ", message);
        session.lastSummarizeIndex = lastSummarizeIndex;
      },
      onError(err) {
        console.error("[Summarize] ", err);
      },
    });
  }
}

export async function callSession(
  session: ChatSession,
  content: string,
  accessToken: string,
  llmConfig: LLMConfig,
  callbacks: {
    onUpdateMessages: (messages: ChatMessage[]) => void;
    onUpdateTopic: (topic: string) => void;
  },
): Promise<ChatMessage | undefined> {
  const modelConfig = session.bot.modelConfig;

  let userMessage: ChatMessage;

  try {
    userMessage = await createUserMessage(content, modelConfig);
  } catch (error: any) {
    // an error occurred when creating user message, show error message as bot message and don't call API
    const userMessage = createMessage({
      role: "user",
      content,
    });
    const botMessage = createMessage({
      role: "assistant",
      id: userMessage.id! + 1,
      content: prettyObject({
        error: true,
        message: error.message || "Invalid user message",
      }),
    });
    // updating the session will trigger a re-render, so it will display the messages
    session.messages = session.messages.concat([userMessage, botMessage]);
    callbacks.onUpdateMessages(session.messages);
    return botMessage;
  }

  const botMessage: ChatMessage = createMessage({
    role: "assistant",
    streaming: true,
    model: modelConfig.model,
  });

  // get recent messages
  const recentMessages = getMessagesWithMemory(session);
  const sendMessages = [
    ...recentMessages.map(transformAssistantMessageForSending),
    transformUserMessageForSending(userMessage),
  ];
  const messageIndex = session.messages.length + 1;

  // save user's and bot's message
  const savedUserMessage = {
    ...userMessage,
    content,
  };
  session.messages = session.messages.concat([savedUserMessage, botMessage]);
  callbacks.onUpdateMessages(session.messages);

  // make request
  let result;
  await api.llm.chat({
    messages: sendMessages,
    config: { ...modelConfig, stream: true },
    share: session.bot.share,
    token: accessToken,
    onUpdate(message) {
      botMessage.streaming = true;
      if (message) {
        botMessage.content = message;
      }
      callbacks.onUpdateMessages(session.messages.concat());
    },
    onFinish(message: string) {
      botMessage.streaming = false;
      if (message) {
        botMessage.content = message;
        session.lastUpdate = Date.now();
        // TODO: render update of chat count and word count
        session.stat.charCount += message.length;
        callbacks.onUpdateMessages(session.messages.concat());
        summarizeSession(session, accessToken, llmConfig, {
          onUpdateTopic: callbacks.onUpdateTopic,
        });
      }
      ChatControllerPool.remove(session.id, botMessage.id);
      result = botMessage;
    },
    onError(error) {
      const isAborted = error.message.includes("aborted");
      botMessage.content +=
        "\n\n" +
        prettyObject({
          error: true,
          message: error.message,
        });
      botMessage.streaming = false;
      userMessage.isError = !isAborted;
      botMessage.isError = !isAborted;
      callbacks.onUpdateMessages(session.messages);
      ChatControllerPool.remove(session.id, botMessage.id ?? messageIndex);

      console.error("[Chat] failed ", error);
      result = botMessage;
    },
    onController(controller) {
      // collect controller for stop/retry
      ChatControllerPool.addController(
        session.id,
        botMessage.id ?? messageIndex,
        controller,
      );
    },
  });
  return result;
}
