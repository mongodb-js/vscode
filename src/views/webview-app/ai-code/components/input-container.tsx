import React from 'react';
import { css } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';

const bannerStyles = css({
  marginTop: spacing[3],
});

const InputContainer: React.FunctionComponent<{
  children?: React.ReactNode;
}> = ({ children }: { children?: React.ReactNode }) => {
  if (!children) {
    return null;
  }

  return <div className={bannerStyles}>{children}</div>;
};

export { InputContainer };
