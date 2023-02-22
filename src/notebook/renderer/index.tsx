import React from 'react';
import ReactDOM from 'react-dom';

import { NotebookOutput } from './render';
import errorOverlay from 'vscode-notebook-error-overlay';
import type { ActivationFunction } from 'vscode-notebook-renderer';

export const activate: ActivationFunction = context => {
	return {
		renderOutputItem(outputItem, element) {
			let shadow = element.shadowRoot;
			if (!shadow) {
				shadow = element.attachShadow({ mode: 'open' });
				const root = document.createElement('div');
				root.id = 'root';
				shadow.append(root);
			}

			const root = shadow.querySelector<HTMLElement>('#root');
			if (!root) {
				throw new Error('Could not find root element');
			}

			errorOverlay.wrap(root, () => {
				root.innerHTML = '';
				const node = document.createElement('div');
				root.appendChild(node);

				ReactDOM.render(<NotebookOutput info={{ container: node, mime: outputItem.mime, value: outputItem, context }} />, root);
			});
		},
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		disposeOutputItem(_outputId) {
			// Do any teardown here. outputId is the cell output being deleted, or
			// undefined if we're clearing all outputs.
		}
	};
};
