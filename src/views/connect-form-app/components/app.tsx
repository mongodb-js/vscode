import * as React from 'react';
import ConnectionForm from './connect-form/connection-form';

export default class App extends React.Component {
  render(): React.ReactNode {
    return (
      <div>
        <h1>MongoDB Connection Details Form</h1>
        <h4>Coming soon.</h4>
        <h4>For now, to connect please use the command palette (Command+Shift+P) and search &apos;Connect with Connection String&apos; and enter a connection string.</h4>
        <h4>Alternatively, you can connect by right clicking the &apos;Connections&apos; item in the explorer and selecting &apos;Add MongoDB connection with Connection String...&apos;</h4>


        <div>
          <ConnectionForm
            currentConnection={{}}
            errorMessage=""
            hasUnsavedChanges={false}
            isConnected={false}
            isHostChanged={false}
            isPortChanged={false}
            isValid={false}
            syntaxErrorMessage=""
          />
        </div>
      </div>
    );
  }
}
