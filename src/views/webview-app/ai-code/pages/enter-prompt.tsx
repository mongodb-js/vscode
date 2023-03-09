import { Body, Label } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import React, { useCallback } from 'react';
import { css } from '@leafygreen-ui/emotion';
import TextArea from '@leafygreen-ui/text-input';
import { spacing } from '@leafygreen-ui/tokens';
import { useSelector, useDispatch } from 'react-redux';

import { setPrompt } from '../store/prompt';
import { generateSuggestions, setStatus } from '../store/codebase';
import type { AppDispatch, RootState } from '../store/store';
import { FileStructure } from '../components/file-structure';
import { InputContainer } from '../components/input-container';
import CancelLoader from '../components/cancel-loader';

const containerStyles = css({
  padding: spacing[3],
});

const codeDescriptionStyles = css({
  marginTop: spacing[3],
});

const autofillStyles = css({
  marginTop: spacing[1],
  marginRight: spacing[1],
});

const submitContainerStyles = css({
  marginTop: spacing[2],
  display: 'flex',
  justifyContent: 'flex-end',
});

const EnterPrompt: React.FunctionComponent = () => {
  const directory = useSelector((state: RootState) => state.codebase.directory);
  const useGithubLink = useSelector(
    (state: RootState) => state.codebase.useGithubLink
  );
  const promptText = useSelector((state: RootState) => state.prompt.promptText);
  const fileStructure = useSelector(
    (state: RootState) => state.codebase.fileStructure
  );
  const githubLink = useSelector(
    (state: RootState) => state.codebase.githubLink
  );
  const codebaseStatus = useSelector(
    (state: RootState) => state.codebase.status
  );
  const dispatch = useDispatch<AppDispatch>();

  const onClickBack = useCallback(() => {
    dispatch(setStatus('initial'));
  }, []);

  const onClickSubmitPrompt = useCallback(() => {
    void dispatch(generateSuggestions());
  }, []);

  const codebaseIdentifier = useGithubLink ? githubLink : directory;

  return (
    <div className={containerStyles}>
      {codebaseStatus === 'loaded' && (
        <>
          <div>
            <Button onClick={onClickBack}>Back</Button>
          </div>
          <Body weight="medium" className={codeDescriptionStyles}>
            Code {codebaseStatus === 'loaded' ? 'loaded' : 'loading'} from{' '}
            {codebaseIdentifier}
          </Body>
        </>
      )}
      {codebaseStatus === 'loading' && (
        <CancelLoader
          progressText="Loading files"
          cancelText="Cancel"
          onCancel={onClickBack} // TODO: Cancel the actual event.
        />
      )}
      {codebaseStatus === 'loaded' && (
        <>
          {/* TODO: Add repo/folder title, show icons. */}
          <FileStructure fileStructure={fileStructure} />
        </>
      )}
      <InputContainer>
        <Label htmlFor="prompt-text-area" id="prompt-text-area-label">
          Enter something you'd like done to the codebase.
        </Label>
        <TextArea
          id="prompt-text-area"
          aria-labelledby="prompt-text-area-label"
          placeholder="Convert javascript files to typescript"
          onChange={(e) => dispatch(setPrompt(e.target.value))}
          value={promptText || ''}
        />
        {!promptText && (
          <>
            <Button
              className={autofillStyles}
              onClick={() =>
                dispatch(setPrompt('Convert javascript files to typescript'))
              }
            >
              autofill
            </Button>
            <Button
              className={autofillStyles}
              onClick={() =>
                dispatch(
                  setPrompt(
                    'Create a basic node js typescript project. Include an eslint config, tsconfig, and an initial test file.'
                  )
                )
              }
            >
              autofill 2
            </Button>
          </>
        )}
        <div className={submitContainerStyles}>
          <Button
            disabled={codebaseStatus === 'loading' || !promptText}
            variant="primary"
            onClick={onClickSubmitPrompt}
          >
            Show proposed changes
          </Button>
        </div>
      </InputContainer>
    </div>
  );
};

export { EnterPrompt };
