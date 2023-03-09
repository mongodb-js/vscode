import * as dotenv from 'dotenv';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config();

function createNewOpenAPIClient() {
  const openAIConfiguration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return new OpenAIApi(openAIConfiguration);
}

let openai: OpenAIApi = {} as any;
let started = false;

// For some reason dotenv is delayed on VSCode?
function getOpenAi() {
  if (started) {
    return openai;
  }

  openai = createNewOpenAPIClient();
  started = true;
  return openai;
}

export { getOpenAi };
