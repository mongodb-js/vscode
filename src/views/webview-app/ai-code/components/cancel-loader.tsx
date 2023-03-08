import React from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { css, cx } from '@leafygreen-ui/emotion';
import Button from '@leafygreen-ui/button';
import { Subtitle } from '@leafygreen-ui/typography';
import { palette } from '@leafygreen-ui/palette';
import { useDarkMode } from '@leafygreen-ui/leafygreen-provider';

import { Loader } from './loader';

const containerStyles = css({
  display: 'flex',
  gap: spacing[2],
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
});

const textStyles = css({
  color: palette.green.dark2,
  textAlign: 'center',
});
const textDarkStyles = css({
  color: palette.green.light2,
});

function CancelLoader({
  progressText,
  cancelText,
  onCancel,
}: {
  progressText: string;
  cancelText: string;
  onCancel: () => void;
}): React.ReactElement {
  const darkMode = useDarkMode();

  return (
    <div className={containerStyles}>
      <Loader size={`${spacing[4]}px`} />
      <Subtitle className={cx(textStyles, !darkMode && textDarkStyles)}>
        {progressText}
      </Subtitle>
      <Button variant="primaryOutline" onClick={onCancel}>
        {cancelText}
      </Button>
    </div>
  );
}

export default CancelLoader;
