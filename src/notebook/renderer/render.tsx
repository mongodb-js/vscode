import React from 'react';
import type { RendererContext } from 'vscode-notebook-renderer';

interface IRenderInfo {
	container: HTMLElement;
	mime: string;
	value: unknown;
	context: RendererContext<unknown>;
}

interface NotebookOutputProps {
	info: IRenderInfo
}

export const NotebookOutput: React.FC<NotebookOutputProps> = ({ info }: NotebookOutputProps) => {
	return (<div>
		<table>
			<tr>
				<th>Issue</th>
				<th>Description</th>
			</tr>
			{JSON.stringify(info.value, null, 2)}
		</table>
	</div>);
};
