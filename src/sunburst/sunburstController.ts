import * as vscode from 'vscode';
import * as path from 'path';

import ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { createVegaSunburstJson } from './sunburstVega';

const log = createLogger('sunburst controller');

const DATBASE_INFO = 'DATBASE_INFO';
const dbToWatch = 'extension-tester';

const sunburstMediaFolder = path.resolve(__dirname, './media');
const sunburstVegaDependencyFile = path.resolve(__dirname, './media/vega.5.9.1.min.js');
const sunburstVegaEmbedDependencyFile = path.resolve(__dirname, './media/vega-embed.6.2.2.min.js');

// <script src="https://cdnjs.cloudflare.com/ajax/libs/vega/5.9.1/vega.min.js"></script>
// https://cdnjs.cloudflare.com/ajax/libs/vega-embed/6.2.2/vega-embed.min.js

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sunburst</title>
        <script src="${sunburstVegaDependencyFile}"></script>
        <script src="${sunburstVegaEmbedDependencyFile}"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/vega/5.9.1/vega.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/vega-embed/6.2.2/vega-embed.min.js"></script>

        <style>
          body {
            background-color: #E7EEEC;
            color: #061621;
          }
          h1 {
            color: #13AA52;
          }
          ul {
            list-style-type: none;
            margin: 20px;
            padding: 20px;
            padding-top: 0;
          }
          li {
            padding: 0;
            margin: 0;
            margin-bottom: 10px;
          }
        </style>
    </head>
    <body>
      <h1>Sunburst</h1>
      <h4 id="loading">
        Loading server, database, & collection stats...
      <h4>
      <div id="sunburstContainer">

      <div>

      <script>
        let isFirstMessage = true;
        // Handle the message inside the webview.
        window.addEventListener('message', event => {
          const message = event.data; // The JSON data our extension sent
          switch (message.command) {
            case '${DATBASE_INFO}':
              document.getElementById('loading').remove();
              vegaEmbed('#sunburstContainer', message.vegaConfig);
              break;
          }
        });
      </script>
    </body>
  </html>`;
}

function asyncableGetCollections(activeConnection: any, databaseName: string): Promise<any[]> {
  return new Promise<any[]>((resolve: any, reject: any) => {
    activeConnection.client.collections(databaseName, (err: any, collections: any[]) => {
      if (err) {
        return reject(err);
      }

      resolve(collections);
    });
  });
}

const openSunburst = (connectionController: ConnectionController): Promise<boolean> => {
  log.info('opening sunburst controller');

  // We just pull the active connection.
  // TODO: Pull whichever one was clicked.
  const activeConnection = connectionController.getActiveConnection();
  if (!activeConnection) {
    vscode.window.showErrorMessage('No active connection to show.');
    return Promise.resolve(false);
  }
  const serverName = connectionController.getActiveConnectionInstanceId();

  // Create and show a new connect dialogue webview.
  const sunburstViewer = vscode.window.createWebviewPanel(
    'sunburstWebview',
    'MongoDB Connection Sunburst View', // Title
    vscode.ViewColumn.One, // Editor column to show the webview panel in.
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(sunburstMediaFolder)]
    }
  );

  sunburstViewer.webview.html = getWebviewContent();

  return new Promise((resolve, reject) => {
    activeConnection.listDatabases(async (err: any, databases: any) => {
      if (err) {
        vscode.window.showErrorMessage(`Error fetching databases for sunburst: ${err.message}`);
        return Promise.reject(new Error(`Error fetching databases for sunburst: ${err.message}`));
      }

      const sunburstData = [{
        name: serverName,
        id: 1,

        // we remove these.
        displaySize: 0,
        size: 1,
        parent: 0 // Maybe this will error.
      }];

      // Hacky avoiding eslint.
      delete sunburstData[0].parent;
      delete sunburstData[0].size;
      delete sunburstData[0].displaySize;

      // Build the database elements onto the sunburst data array.
      databases.forEach((database: any, index: number) => {
        sunburstData.push({
          name: database.name,
          displaySize: database.sizeOnDisk,
          id: index + 2,
          parent: 1,

          size: database.sizeOnDisk
        });

        // eslint workaround
        delete sunburstData[sunburstData.length - 1].size;
      });

      try {
        // files.map(async (file) => {
        //   const contents = await fs.readFile(file, 'utf8')
        //   console.log(contents)
        // }));
        // Fetch collection data and build it into the sunburst data array.
        await Promise.all(databases.map(async (database: any, databaseIndex: number) => {
          const collections = await asyncableGetCollections(activeConnection, database.name);

          // console.log('collections for db', database.name, collections);
          // TODO: 'collection' vs 'view' type.

          /**
            Things on the collection:
            database: "local"
            document_count: 1
            document_size: 45
            index_count: 1
            index_details: {_id_: {…}}
            index_size: 20480
            index_sizes: {_id_: 20480}
            is_capped: false
            is_power_of_two: false
            name: "replset.minvalid"
            ns: "local.replset.minvalid"
            readonly: false
            sharded: false
            shards: {}
            size: 45
            storage_size: 20480
          **/

          // TODO: When the internet is out this behavior is a bit off.
          // Better loader / async resources?

          collections.forEach((collection: any) => {
            const collectionTotalSize = collection.index_size + Math.max(collection.document_size, collection.storage_size);
            sunburstData.push({
              name: collection.name,
              displaySize: collectionTotalSize,
              // size: collection.index_size + Math.max(collection.document_size, collection.storage_size),
              id: sunburstData.length + 1,
              parent: databaseIndex + 2,

              size: 0
            });

            // eslint workaround
            delete sunburstData[sunburstData.length - 1].size;

            sunburstData.push({
              name: `data in ${collection.name}`,
              displaySize: collectionTotalSize - collection.index_size,
              size: collectionTotalSize - collection.index_size,
              id: sunburstData.length + 1,
              parent: sunburstData.length
            });

            sunburstData.push({
              name: `indexes in ${collection.name}`,
              displaySize: collection.index_size,
              size: collection.index_size,
              id: sunburstData.length + 1,
              parent: sunburstData.length - 1
            });

            // TODO: We can further break down indexes.
          });
        }));
      } catch (collectionsErr) {
        if (collectionsErr) {
          vscode.window.showErrorMessage(`Error fetching database collections for sunburst view: ${collectionsErr.message}`);
          return reject(new Error(`Error fetching database collections for sunburst view: ${collectionsErr.message}`));
        }
      }

      console.log('dbInfo', sunburstData);

      sunburstViewer.webview.postMessage({
        command: DATBASE_INFO,
        vegaConfig: createVegaSunburstJson(sunburstData)
      }).then(resolve, reject);
    });
  });
};

export default openSunburst;
