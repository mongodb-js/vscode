import { openai } from './ai';
import type { FileDirectory } from './constants';

export type DeleteOperation = {
  operation: 'delete';
};

export type RenameOperation = {
  operation: 'rename';
  name: string;
};

export type DoNothingOperation = {
  operation: 'none';
};

export type ExpandedOperation = {
  operation: 'expand';
  names: string[];
};

export type CreateOperation = {
  operation: 'add';
  names: string[];
};

export type FileMappingOperation =
  | DeleteOperation
  | RenameOperation
  | DoNothingOperation
  | ExpandedOperation
  | CreateOperation;

export function getFileNamesFromFileStructure(
  fileStructure: FileDirectory,
  prefix: string
): string[] {
  let fileNames: string[] = [];
  for (const [name, contents] of Object.entries(fileStructure)) {
    if (typeof contents === 'string') {
      fileNames.push(`${prefix}${name}`);
    } else {
      fileNames = fileNames.concat(
        getFileNamesFromFileStructure(contents, `${prefix}${name}/`)
      );
    }
  }

  return fileNames;
}

export function createMappingPrompt(
  instructions: string,
  fileStructure: FileDirectory
) {
  // For example, consider the following file structure with the instructions "convert javascript to typescript":
  // ["folderName/test.js", ""]
  // This would generate the file mapping json output:
  // {
  //   "folderName/test.js": {
  //     "operation": "rename",
  //     "name": "folderName/test.ts"
  //   }
  // }

  // The instructions to use for generating the file mapping are: "${opts.instructions}".

  // Response with the mapping in a json format.

  const inputFileNames = getFileNamesFromFileStructure(fileStructure, '');
  console.log('Input file names:', inputFileNames);

  if (inputFileNames.length === 0) {
    // TODO: Remove this when we allow creating new projects.
    throw new Error('no files');
  }

  // Create a high level file mapping user to perform changes on or even generate files on a code base.
  // Create a high level file mapping user to perform changes on a code base.

  const mappingPrompt = `
Create a high level file mapping user to perform changes on or even generate files on a code base.
Response with the mapping in a json format.
If nothing should happen to the file structure, which often happens when the instructions are intended for the code inside of files, use the "operation" "none".
If a file is to be deleted, use the "operation" "delete".
If a file is to be renamed, use the "operation" "rename".
If a file is to be added, use the "operation" "add".
If a file is to be expanded into multiple files, use the "operation" "expand".
Example 1:
Input:
Instructions: "convert javascript to typescript"
["src/test.js", "src/testTwo.js"]
Output:
{
  "src/test.js": {
    "operation": "rename",
    "name": "src/test.ts"
  },
  "src/testTwo.js": {
    "operation": "rename",
    "name": "src/testTwo.ts"
  }
}
Example 2:
Input:
Instructions: "convert usage of the "async" package to use "async/await""
["pineapples/index.js", "pineapples/main.js"]
Output:
{
  "src/index.js": {
    "operation": "none"
  },
  "src/main.js": {
    "operation": "none"
  }
}
Example 3:
Input:
Instructions: "create a basic node js package and repo with eslint"
[]
Output:
{
  "index.js": {
    "operation": "add"
  },
  "package.json": {
    "operation": "add"
  },
  ".gitignore": {
    "operation": "add"
  },
  ".eslintrc.js": {
    "operation": "add"
  }
}
Now it's your turn.
Input:
Instructions: "${instructions}"
[${inputFileNames.map((fileName) => `"${fileName}"`).join(', ')}]
Output:
`;

  return mappingPrompt;
}

export function parseMapping(text: string) {
  let mapping;
  try {
    mapping = JSON.parse(text);
  } catch (err) {
    console.error(err);

    throw new Error(
      `Unable to parse file mapping request response. It used the instructions: ${err}`
    );
  }

  console.log('\nParsed mapping:');
  console.log(mapping);

  return mapping;
}

export type FileMapPlan = {
  [fileName: string]: FileMappingOperation;
};

async function generateFileMappingPlan(
  instructions: string,
  fileStructure: FileDirectory
): Promise<FileMapPlan> {
  // 1. Calculate the high level file mapping to use.
  // We want to see if the file structure changes. (example: .js -> .ts)
  // We pass the file structure along with the instructions to a more generalized gpt model.
  // This then tells us where things should map to.

  // TODO:
  // Chat gpt api usage

  // Different orderings of instructions/mapping.
  // Different example mappings.
  // Different output formats (json, text, yaml, etc.)
  // Provide a specific response if the ai can't figure it out.

  // TODO: Fine tune the models with our test data.
  // https://platform.openai.com/docs/guides/fine-tuning

  const mappingPrompt = createMappingPrompt(instructions, fileStructure);

  console.log('mappingPrompt', mappingPrompt);

  let mappingResponse;
  try {
    // https://beta.openai.com/docs/models/gpt-3
    // We're using `text-davinci-003` to do the mapping. It's trained up till June 2021.
    // https://platform.openai.com/docs/api-reference/completions/create
    mappingResponse = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: mappingPrompt,

      // https://platform.openai.com/tokenizer
      // TODO: Calculate the max tokens using the amount of files/folders and the complexity of instructions.
      max_tokens: 200,

      // What sampling temperature to use. Higher values means the model will take more risks.
      // Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer.
      // https://towardsdatascience.com/how-to-sample-from-language-models-682bceb97277
      temperature: 0,

      // n: 1 // How many edits to generate for the input and instruction. (Defaults 1).
    });
  } catch (err: any) {
    if (err?.response) {
      console.error(err.response.status);
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }

    throw new Error(
      `Unable to perform openai 'text-davinci-003' file mapping request using instructions "${instructions}": ${err}`
    );
  }

  // "choices": [
  //   {
  //     "text": "\n\nThis is indeed a test",
  //     "index": 0,
  //     "logprobs": null,
  //     "finish_reason": "length"
  //   }
  // ],
  // "usage": {
  //   "prompt_tokens": 5,
  //   "completion_tokens": 7,
  //   "total_tokens": 12
  // }

  // TODO: Ask the mapping ai to give an explanation for why it's doing what its doing.

  console.log('\nMapping response text:');
  console.log(mappingResponse.data.choices[0].text);

  return parseMapping(mappingResponse.data.choices[0].text);
}

export { generateFileMappingPlan };
