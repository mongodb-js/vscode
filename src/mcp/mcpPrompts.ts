// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerMongoDBPrompts(server: {
  mcpServer: any;
  tools: any[];
}): void {
  const { mcpServer, tools } = server;
  for (const tool of tools as Array<{
    name: string;
    description: string;
    isEnabled(): boolean;
  }>) {
    if (!tool.isEnabled()) continue;
    const { name, description } = tool;
    mcpServer.registerPrompt(name, { title: name, description }, () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: 'Please use the ' + name + ' tool.',
          },
        },
      ],
    }));
  }
}
