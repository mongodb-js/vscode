import path from 'path';
import { promises as fs } from 'fs';

import { AIBackend } from './ai-backend';

function getGenerateQueryPrompt() {
  return `You are a test user for a chat service.
In this chat service, you are asking questions about a MongoDB database.
You can imagine any dataset or use case you like.
Get creative - but not toooo crazy, ideally something real, it can be comical or insightful.
For the first part of this chat we want you to return an example message that a user may ask about their dataset.
This could be something meta, like how many documents match a certain thing, or a more complex pipeline to get documents or update documents.
Return 3 example cases in the specified format (js objects).

Example:
[{
  dataset: {
    db: 'UFO',
    coll: 'sightings',
    documents: [{
      description:
        'Portal in the sky created by moving object, possibly just northern lights.',
      where: 'Alaska',
      year: '2020',
    }, {
      description:
        'Someone flying on a broomstick, sighters reported "It looks like Harry Potter".',
      where: 'New York',
      year: '2022',
    }]
  },
  userPrompt: 'How many sightings happened in New York? Only include occurrences after 2020.'
}]`;
}

async function main() {
  const aiBackend = new AIBackend('openai');

  const prompt = getGenerateQueryPrompt();

  console.log('Generating prompt...');

  const chatCompletion = await aiBackend.runAIChatCompletionGeneration({
    messages: [
      {
        content: prompt,
        role: 'user',
      },
    ],
  });

  console.log('chat completion:');
  console.log(chatCompletion);

  await fs.writeFile(
    path.join(
      __dirname,
      'fixtures',
      `user-prompts-${Math.floor(Math.random() * 1000)}.js`
    ),
    chatCompletion.content
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
