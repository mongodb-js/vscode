import { Body } from '@leafygreen-ui/typography';
import React from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';
import { palette } from '@leafygreen-ui/palette';

import type { FileDirectory } from '../../../../ai-code/constants';

const containerStyles = css({
  padding: spacing[3],
});

const folderContainerStyles = css({
  paddingLeft: spacing[2],
  borderLeft: `1px solid ${palette.gray.light2}`,
});

const Folder: React.FunctionComponent<{
  directory: FileDirectory;
  folderName?: string;
}> = ({
  directory,
  folderName,
}: {
  directory: FileDirectory;
  folderName?: string;
}) => {
  return (
    <>
      {!!folderName && <Body>{folderName} V</Body>}
      <div className={cx(folderName && folderContainerStyles)}>
        {Object.entries(directory).map(([name, contents]) =>
          typeof contents === 'string' ? (
            <Body key={name}>{name}</Body>
          ) : (
            <Folder directory={contents} folderName={name} key={name} />
          )
        )}
      </div>
    </>
  );
};

const FileStructure: React.FunctionComponent<{
  fileStructure: FileDirectory | null;
  // eslint-disable-next-line react/no-multi-comp
}> = ({ fileStructure }: { fileStructure: FileDirectory | null }) => {
  if (!fileStructure || Object.keys(fileStructure).length === 0) {
    return (
      <div className={containerStyles}>
        <Body>No files currently in the codebase.</Body>
      </div>
    );
  }

  return (
    <div className={containerStyles}>
      <Folder directory={fileStructure} />
    </div>
  );
};

export { FileStructure };
