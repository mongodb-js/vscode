import type {
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
} from 'openai';

import { openai } from './ai';

type ChatMessage = {
  content: string;
  role: ChatCompletionRequestMessageRoleEnum;
};

export class ChatBot {
  isInOperation = false;
  chatHistory: ChatMessage[] = [];

  async startChat(message: string) {
    if (this.isInOperation) {
      throw new Error('Chat already started.');
    }

    this.isInOperation = true;

    let response: ChatCompletionResponseMessage;

    const messageToSend = {
      // TODO: User system commands for mapping request?
      role: 'user' as ChatCompletionRequestMessageRoleEnum,
      content: message,
    };

    try {
      // https://platform.openai.com/docs/api-reference/chat/create
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo', // gpt-3.5-turbo and gpt-3.5-turbo-0301
        messages: [messageToSend],
        // temperature: number, What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
        // n: number, // Suggestion output count.
        // max_tokens: number, // The maximum number of tokens allowed for the generated answer. By default, the number of tokens the model can return will be (4096 - prompt tokens).
      });

      // console.log('chatbot response', completion.data.choices[0].message);

      response = completion.data.choices[0]
        .message as ChatCompletionResponseMessage;
    } catch (e) {
      console.log('chatbot initial error', e);

      throw e;
    } finally {
      this.isInOperation = false;
    }

    this.chatHistory.push(messageToSend);
    this.chatHistory.push(response);

    return response;
  }

  async continueChat(message: string) {
    if (this.isInOperation) {
      throw new Error('Message already in progress');
    }

    this.isInOperation = true;

    let response: ChatCompletionResponseMessage;

    const messageToSend: ChatMessage = {
      role: 'user',
      content: message,
    };

    try {
      // https://platform.openai.com/docs/api-reference/chat/create
      const completion = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [...this.chatHistory, messageToSend],
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

    this.chatHistory.push(messageToSend);
    this.chatHistory.push(response);

    return response;
  }
}
