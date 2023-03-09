import Banner from '@leafygreen-ui/banner';
import React from 'react';
import { css } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';

const bannerStyles = css({
  marginTop: spacing[3],
});

function ErrorBanner({ errorMessage }: { errorMessage?: string | null }) {
  if (!errorMessage) {
    return null;
  }

  return (
    <Banner className={bannerStyles} variant="danger" dismissible>
      {errorMessage}
    </Banner>
  );
}

export { ErrorBanner };
