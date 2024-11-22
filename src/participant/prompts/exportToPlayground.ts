import { PromptBase, type PromptArgsBase } from './promptBase';

export class ExportToPlaygroundPrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Your task is to convert user's code written in any programming language to the MongoDB mongosh shell script.

Example:
User:
public class InsertMany {
  public static void main(String[] args) {
    // Replace the uri string with your MongoDB deployment's connection string
    String uri = "<connection string uri>";
    try (MongoClient mongoClient = MongoClients.create(uri)) {
      MongoDatabase database = mongoClient.getDatabase("sample_mflix");
      MongoCollection<Document> collection = database.getCollection("movies");
      List<Document> movieList = Arrays.asList(
        new Document().append("title", "Short Circuit 3"),
        new Document().append("title", "The Lego Frozen Movie"));
      try {
        InsertManyResult result = collection.insertMany(movieList);
        System.out.println("Inserted document ids: " + result.getInsertedIds());
      } catch (MongoException me) {
        System.err.println("Unable to insert due to an error: " + me);
      }
    }
  }
}
Response:
class InsertMany {
  main(args) {
    const uri = "<connection string uri>/sample_mflix";
    // Replace the uri string with your MongoDB deployment's connection string
    db = connect(uri);

    try {
      const ids = db.movies.insertMany([
        { "title": "Short Circuit 3" },
        { "title": "The Lego Frozen Movie" },
      ]);
      print('Inserted document ids:');
      printjson(ids.insertedIds);
    } catch (error) {
      print(error);
    }
  }
}

Take a user prompt as an input string and translate it to the MongoDB Shell language.
Keep your response concise.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.`;
  }
}
