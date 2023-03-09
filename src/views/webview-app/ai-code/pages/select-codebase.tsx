import { Body } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import React, { useCallback } from 'react';
import { css } from '@leafygreen-ui/emotion';
// import TextInput from '@leafygreen-ui/text-input';
import { spacing } from '@leafygreen-ui/tokens';
// import { dialog } from '@electron/remote';
import { useDispatch } from 'react-redux';

import { loadCodebase } from '../store/codebase';

import type { AppDispatch } from '../store/store';
import { InputContainer } from '../components/input-container';

const containerStyles = css({
  padding: spacing[3],
  paddingTop: 0,
});

const optionsContainerStyles = css({
  // display: 'flex',
  // flexDirection: 'row',
  // gap: spacing[3],
});

const linkContainerStyles = css({
  flexGrow: 1,
});

const leftAlignStyles = css({
  textAlign: 'left',
});

const sectionContainerStyles = css({
  marginTop: spacing[2],
  textAlign: 'center',
});

const SelectCodebase: React.FunctionComponent = () => {
  const dispatch = useDispatch<AppDispatch>();

  const onClickAnalyzeCodebase = useCallback(() => {
    void dispatch(loadCodebase());
  }, []);

  return (
    <div className={containerStyles}>
      {/* TODO: Offer the option to start a new project. */}
      <InputContainer>
        <div className={optionsContainerStyles}>
          <div className={linkContainerStyles}>
            <div className={sectionContainerStyles}>
              <Body className={leftAlignStyles} weight="medium">
                Let the ai write code for you. First it analyzes your workspace,
                with that context it can explain, refactor, and even generate
                code in your files.
              </Body>
            </div>
            <div className={sectionContainerStyles}>
              <Button variant="primary" onClick={onClickAnalyzeCodebase}>
                Analyze workspace
              </Button>
            </div>
          </div>
        </div>
      </InputContainer>
    </div>
  );
};

export { SelectCodebase };
