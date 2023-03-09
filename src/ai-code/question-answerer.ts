// import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { ObjectId } from 'bson';

// dotenv.config();

import { ChatBot } from './chat-bot';
import type { ConversationHistory } from './constants';
// import { v4 as uuidv4 } from 'uuid';

// Example POST method implementation:
async function postData(
  url: string,
  data: {
    question: string;
    conversation_id: string;
  }
) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  console.log('full response', response);
  const responseJSON = await response.json();
  console.log('response JSON', response);

  return JSON.stringify(responseJSON);
}

function createPromptWithCodeSelection({
  text,
  codeSelection,
}: {
  text: string;
  codeSelection?: string;
}) {
  let prefix = '';

  if (!askTheOracle) {
    prefix =
      'Please answer the following MongoDB related question with the context that you are a MongoDB technical information chatbot. The question is:\n';
  }

  if (!codeSelection || codeSelection.trim().length === 0) {
    return text;
  }

  return `${prefix}${text}

  Code snippet below:
  ${codeSelection}`;
}
const useTheOracle = false; // true;

// const useTheOracle = false; // true;
async function askTheOracle({
  conversationId,
  newMessage,
}: {
  conversationId: string;

  history: ConversationHistory;
  newMessage?: {
    text: string;
    codeSelection?: string;
  };
}) {
  if (!process.env.QUESTION_ASK_URL) {
    throw new Error('No QUESTION_ASK_URL in environment.');
  }

  // Ask it to rephrase. (Not regenerating based with same history).
  let promptText = 'Can you rephrase that?';
  if (newMessage) {
    if (newMessage.codeSelection) {
      promptText = createPromptWithCodeSelection({
        text: newMessage.text,
        codeSelection: newMessage.codeSelection,
      });
    } else {
      promptText = newMessage.text;
    }
  }

  return {
    text: await postData(process.env.QUESTION_ASK_URL, {
      question: promptText,
      conversation_id: conversationId,
    }),
    questionText: promptText,
  };
}

export async function askQuestion({
  history,
  newMessage,
  conversationId = new ObjectId().toString(),
}: {
  conversationId: string; // ObjectId
  history: ConversationHistory;
  newMessage?: {
    text: string;
    codeSelection?: string;
  };
}): Promise<{
  text: string;
  questionText: string;
}> {
  // console.log('ask question', text, 'use oracle:', useTheOracle);
  if (useTheOracle) {
    return await askTheOracle({
      history,
      newMessage,
      conversationId,
    });
  }

  const chatBot = new ChatBot();

  const chatHistory: ConversationHistory = [
    ...history,
    ...(newMessage
      ? [
          {
            role: 'user',
            content: createPromptWithCodeSelection(newMessage),
          },
        ]
      : []),
  ] as ConversationHistory;

  const response = await chatBot.completeChat(chatHistory);

  // if (history.length > 0) {
  //   await chatBot.complete(
  //     [history, {
  //       agent
  //     }]
  //   );
  // }

  // const response = await chatBot.startChat(
  //   createPromptWithCodeSelection({
  //     text,
  //     codeSelection,
  //   })
  // );

  return {
    text: response.content,
    questionText: (chatHistory[chatHistory.length - 1].role === 'user'
      ? chatHistory[chatHistory.length - 1]
      : chatHistory[chatHistory.length - 2] ||
        chatHistory[chatHistory.length - 1]
    ).content,
  };
}
