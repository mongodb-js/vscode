// @ts-check
// @ts-ignore
(function () {
  // Script run within the webview itself.
  console.log('running....');
  // Get a reference to the VS Code webview api.
  // We use this API to post messages back to our extension.

  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const notesContainer = /** @type {HTMLElement} */ (
    document.querySelector('#documents')
  );

  const errorContainer = document.createElement('div');
  document.body.appendChild(errorContainer);
  errorContainer.className = 'error';
  errorContainer.style.display = 'none';

  /**
   * Render the document in the webview.
   */
  function updateContent(/** @type {string} */ text) {
    let json;
    try {
      if (!text) {
        text = '{}';
      }
      json = JSON.parse(text);
    } catch {
      notesContainer.style.display = 'none';
      errorContainer.innerText = 'Error: Document is not valid json';
      errorContainer.style.display = '';
      return;
    }
    notesContainer.style.display = '';
    errorContainer.style.display = 'none';

    json = Array.isArray(json) ? json : [json];

    // Render the scratches
    notesContainer.innerHTML = '';
    const count = document.createElement('vscode-badge');
    count.textContent = `${json.length} documents found`;
    count.variant = 'counter';
    count.style.marginBottom = '0.5rem';
    count.style.marginTop = '0.5rem';

    notesContainer.appendChild(count);

    // @ts-ignore
    require(['vs/editor/editor.main'], () => {
      console.log('Monaco Loaded');
      for (const note of json || []) {
        const element = document.createElement('div');
        element.style.width = '100%';
        element.style.minHeight = '100px';
        element.className = 'note';
        element.style.overflow = 'hidden';
        notesContainer.appendChild(element);
        console.log(element, note);

        // @ts-ignore
        monaco.editor.defineTheme('vs-custom', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': window
              .getComputedStyle(document.documentElement)
              .getPropertyValue('--vscode-editor-background'),
          },
        });
        // @ts-ignore
        var editor = monaco.editor.create(element, {
          value: [JSON.stringify(note, null, 2)].join('\n'),
          language: 'json',
          theme: 'vs-custom',
          automaticLayout: true,
          padding: { top: 0, bottom: 0 },
          scrollBeyondLastLine: false,
          scrollbar: {
            alwaysConsumeMouseWheel: false,
            vertical: 'hidden',
          },
          minimap: {
            enabled: false,
          },
        });
        // Resize to fit the content; 19 is the default line height.
        editor.layout({ height: editor.getModel().getLineCount() * 19 });
      }
    });

    // @ts-ignore
    // notesContainer.appendChild(addButtonContainer);
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case 'update':
        const text = message.text;

        // Update our webview's content
        updateContent(text);

        // Then persist state information.
        // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
        vscode.setState({ text });

        return;
    }
  });

  // Webviews are normally torn down when not visible and re-created when they become visible again.
  // State lets us save information across these re-loads
  const state = vscode.getState();
  console.log(vscode);
  if (state) {
    updateContent(state.text);
  }
})();
