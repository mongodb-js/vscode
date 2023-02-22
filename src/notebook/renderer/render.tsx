import React from 'react';
import type { RendererContext, OutputItem } from 'vscode-notebook-renderer';

interface IRenderInfo {
	container: HTMLElement;
	outputItem: OutputItem;
	context: RendererContext<unknown>;
}

interface NotebookOutputProps {
	info: IRenderInfo
}

export const NotebookOutput: React.FC<NotebookOutputProps> = ({ info }: NotebookOutputProps) => {
	// const json = JSON.parse(info.outputItem.text());
	const json = info.outputItem.json();

	return (<div>
		<table>
			<tr>
				{Object.keys(json[0]).map((key) => (<th>${key}</th>))}
			</tr>
		</table>
	</div>);
};
