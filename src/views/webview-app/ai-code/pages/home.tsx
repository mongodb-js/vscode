import React, { useCallback, useMemo } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';
import { useSelector, useDispatch } from 'react-redux';

import { SelectCodebase } from './select-codebase';
import { EnterPrompt } from './enter-prompt';
import { ViewSuggestions } from './view-suggestions';
import { AppDispatch, RootState } from '../store/store';
import { ErrorBanner } from '../components/error-banner';
import { setStatus } from '../store/codebase';
import { AIAssistant } from './ai-assistant';

const containerStyles = css({
  // padding: spacing[3],
  // paddingTop: 0,
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  top: 0,
});
const errorContainerStyles = css({
  padding: spacing[3],
  // paddingTop: 0,
});

const historyStyles = css({
  position: 'absolute',
  // bottom: spacing[2],
  // TODO: Not view height for this,
  // proper scrolling component with height calc.
  bottom: '80vh',
  left: 0,
  right: 0,
});

const historyOverlayStyles = css({
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  background: 'white',
  opacity: 0.5,
  zIndex: 1,

  '&:hover': {
    cursor: 'pointer',
  },
});

const presentContainerStyles = css({
  position: 'absolute',
  // TODO: Not view height for this,
  // proper scrolling component with height calc.
  // top: spacing[4],
  top: 0,
  left: 0,
  right: 0,
});

const presentWithHistoryStyles = css({
  // TODO: Not view height for this,
  // proper scrolling component with height calc.
  top: '20vh',
});

const Home: React.FunctionComponent = () => {
  const codebaseStatus = useSelector(
    (state: RootState) => state.codebase.status
  );
  const errorMessage = useSelector(
    (state: RootState) => state.codebase.errorMessage
  );
  const questionErrorMessage = useSelector(
    (state: RootState) => state.question.errorMessage
  );
  const dispatch = useDispatch<AppDispatch>();

  const history = useMemo(() => {
    const pastForms: React.ReactNode[] = [];
    if (codebaseStatus !== 'initial') {
      pastForms.push(<SelectCodebase key="initial" />);
    }
    if (
      codebaseStatus === 'generating-suggestions' ||
      codebaseStatus === 'suggested'
    ) {
      pastForms.push(<EnterPrompt key="loaded" />);
    }

    return pastForms;
  }, [codebaseStatus]);

  const present = useMemo(() => {
    if (codebaseStatus === 'initial') {
      return <SelectCodebase key={codebaseStatus} />;
    }
    if (codebaseStatus === 'loading' || codebaseStatus === 'loaded') {
      return <EnterPrompt key={codebaseStatus} />;
    }
    if (
      codebaseStatus === 'generating-suggestions' ||
      codebaseStatus === 'suggested'
    ) {
      return <ViewSuggestions key={codebaseStatus} />;
    }

    // Default case?
    return null;
  }, [codebaseStatus]);

  // TODO: this should be in the store and activatable for each component.
  // With a wrapping component that manages the styles and other things.
  const goBackInHistory = useCallback(() => {
    // TODO: Cancel async reqs. Rn would move to the other view if fufilled after.

    if (codebaseStatus === 'loading' || codebaseStatus === 'loaded') {
      dispatch(setStatus('initial'));
    }
    if (
      codebaseStatus === 'generating-suggestions' ||
      codebaseStatus === 'suggested'
    ) {
      dispatch(setStatus('loaded'));
    }
  }, [codebaseStatus]);

  const hasHistory = history.length > 0;
  const renderCodeAssistant = (window as any)?.isCodeWindow;

  return (
    <div className={containerStyles}>
      {!renderCodeAssistant && (
        <>
          {(errorMessage || questionErrorMessage) && (
            <div className={errorContainerStyles}>
              <ErrorBanner
                errorMessage={errorMessage || questionErrorMessage}
              />
            </div>
          )}
          <AIAssistant />
        </>
      )}
      {renderCodeAssistant && (
        <>
          {hasHistory && (
            <div
              className={historyStyles}
              // TODO: Make this click registered for each history
              // element and navigate accordingly.
            >
              {history}
              <div
                // TODO: not a clickable div for accessibility.
                className={historyOverlayStyles}
                onClick={() => goBackInHistory()}
              />
            </div>
          )}
          <div
            className={cx(
              presentContainerStyles,
              hasHistory && presentWithHistoryStyles
            )}
          >
            {present}
            <div className={errorContainerStyles}>
              <ErrorBanner
                errorMessage={errorMessage || questionErrorMessage}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export { Home };
