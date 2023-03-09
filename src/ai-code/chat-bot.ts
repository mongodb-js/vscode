import type {
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
} from 'openai';

import { getOpenAi } from './ai';

type ChatMessage = {
  content: string;
  role: ChatCompletionRequestMessageRoleEnum;
};

export class ChatBot {
  isInOperation = false;
  chatHistory: ChatMessage[] = [];

  async startChat(message: string) {
    const messageToSend = {
      // TODO: User system commands for mapping request?
      role: 'user' as ChatCompletionRequestMessageRoleEnum,
      content: message,
    };

    const response = await this.completeChat([messageToSend]);

    this.chatHistory.push(messageToSend);
    this.chatHistory.push(response);

    return response;
  }

  async continueChat(message: string) {
    const messageToSend: ChatMessage = {
      role: 'user',
      content: message,
    };

    const response = await this.completeChat([
      ...this.chatHistory,
      messageToSend,
    ]);

    this.chatHistory.push(messageToSend);
    this.chatHistory.push(response);

    return response;
  }

  async completeChat(messages: ChatMessage[]) {
    if (this.isInOperation) {
      throw new Error('Message already in progress');
    }

    this.isInOperation = true;

    let response: ChatCompletionResponseMessage;

    try {
      // https://platform.openai.com/docs/api-reference/chat/create
      const completion = await getOpenAi().createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: messages,
      });

      // console.log(completion.data.choices[0].message);

      response = completion.data.choices[0]
        .message as ChatCompletionResponseMessage;
    } catch (e) {
      console.log('chatbot error', e);

      throw e;
    } finally {
      this.isInOperation = false;
    }

    return response;
  }
}
