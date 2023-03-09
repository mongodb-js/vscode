// import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

// dotenv.config();

import { ChatBot } from './chat-bot';
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
async function askTheOracle({
  text,
  includeSelectionInQuestion,
  codeSelection,
}: {
  text: string;
  includeSelectionInQuestion: boolean;
  codeSelection?: string;
}) {
  if (!process.env.QUESTION_ASK_URL) {
    throw new Error('No QUESTION_ASK_URL in environment.');
  }

  let promptText = text;
  if (includeSelectionInQuestion && codeSelection) {
    promptText = createPromptWithCodeSelection({
      text,
      codeSelection,
    });
  }

  return await postData(process.env.QUESTION_ASK_URL, {
    conversation_id: `rhys-test-${Math.floor(Math.random() * 10000)}`, // uuidv4(),
    question: promptText,
  });
}

export async function askQuestion({
  text,
  includeSelectionInQuestion,
  codeSelection,
}: {
  text: string;
  includeSelectionInQuestion: boolean;
  codeSelection?: string;
}) {
  console.log('ask question', text, 'use oracle:', useTheOracle);
  console.log(
    'includeSelectionInQuestion',
    includeSelectionInQuestion,
    'codeSelection:',
    codeSelection
  );
  if (useTheOracle) {
    return await askTheOracle({
      text,
      includeSelectionInQuestion,
      codeSelection,
    });
  }

  const chatBot = new ChatBot();

  const response = await chatBot.startChat(
    createPromptWithCodeSelection({
      text,
      codeSelection,
    })
  );

  return response.content;
}
