import React from 'react';
import { css, cx, keyframes } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { useDarkMode } from '@leafygreen-ui/leafygreen-provider';
import { spacing } from '@leafygreen-ui/tokens';

interface LoaderProps {
  size?: string;
  title?: string;
  className?: string;
}

const shellLoaderSpin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const spinLoaderStyle = css`
  border: 3px solid transparent;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  display: inline-block;

  animation: ${shellLoaderSpin} 700ms ease infinite;
`;
const lightStyles = css({
  borderTop: `3px solid ${palette.gray.dark3}`,
});

const darkStyles = css({
  borderTop: `3px solid ${palette.gray.light3}`,
});

// This is from Compass.
function Loader({
  size = `${spacing[3]}px`,
  title,
  className,
}: LoaderProps): JSX.Element {
  const darkMode = useDarkMode();

  return (
    <div
      className={cx(
        spinLoaderStyle,
        darkMode ? lightStyles : darkStyles,
        className
      )}
      style={{
        width: size,
        height: size,
      }}
      title={title}
    />
  );
}

export { Loader };
