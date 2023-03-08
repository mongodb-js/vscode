import { Body, Label } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import React, { useCallback, useEffect } from 'react';
import { css } from '@leafygreen-ui/emotion';
import TextInput from '@leafygreen-ui/text-input';
import { spacing } from '@leafygreen-ui/tokens';
// import { dialog } from '@electron/remote';
import { useSelector, useDispatch } from 'react-redux';

import {
  loadCodebase,
  // setDirectory,
  setQuestionPrompt,
  setGithubLink,
  // setUseGithubLink,
} from '../store/codebase';
import type { AppDispatch, RootState } from '../store/store';
import { InputContainer } from '../components/input-container';

const containerStyles = css({
  padding: spacing[4],
  paddingTop: 0,
});

const optionsContainerStyles = css({
  display: 'flex',
  flexDirection: 'row',
  gap: spacing[3],
});

const linkContainerStyles = css({
  flexGrow: 1,
});

const autofillStyles = css({
  marginTop: spacing[1],
});

// const submitGithubLinkStyles = css({
//   marginTop: spacing[2],
//   display: 'flex',
//   justifyContent: 'flex-end',
// });

const analyzeWorkspaceContainerStyles = css({
  textAlign: 'center',
});

// function openFolder() {
//   return dialog.showOpenDialog({
//     properties: ['openDirectory'],
//   });
// }

const SelectCodebase: React.FunctionComponent = () => {
  // const directory = useSelector((state: RootState) => state.codebase.directory);
  const questionPrompt = useSelector(
    (state: RootState) => state.codebase.questionPrompt
  );
  // const githubLink = useSelector(
  //   (state: RootState) => state.codebase.githubLink
  // );
  const dispatch = useDispatch<AppDispatch>();

  // useEffect(() => {
  //   // When the user has chosen a directory we navigate to the prompt entering.
  //   if (directory) {
  //     dispatch(loadCodebase());
  //   }
  // }, [directory]);

  // const onClickSelectFolder = useCallback(async () => {
  //   const folderPath = await openFolder();

  //   dispatch(
  //     setDirectory(
  //       folderPath.canceled || folderPath.filePaths.length === 0
  //         ? null
  //         : folderPath.filePaths[0]
  //     )
  //   );
  // }, []);

  // const onClickSubmitGithubLink = useCallback(() => {
  //   // TODO: Link validation.
  //   dispatch(setUseGithubLink(true));
  //   dispatch(loadCodebase());
  // }, []);

  const onClickAnalyzeCodebase = useCallback(() => {
    dispatch(loadCodebase());
  }, []);

  return (
    <div className={containerStyles}>
      {/* <Body>
        Welcome! This is an Large Language Model (LLM) powered tool that
        suggests changes to existing codebases, or can suggest the code to start
        new projects.
      </Body> */}
      <Body>
        Hello! I am a Large Language Model (LLM) powered tool that helps you
        work with your MongoDB database as you code.
      </Body>
      {/* <Body>
        Hello! I am a Large Language Model (LLM) powered tool that
        suggests changes to existing codebases, or can suggest the code to start
        new projects.
      </Body> */}
      {/* <Body>First let's find a place to make changes.</Body> */}
      {/* TODO: Offer the option to start a new project. */}
      <InputContainer>
        <div className={optionsContainerStyles}>
          {/* <div>
            <Label htmlFor="select-folder-button">Select a local folder</Label>
            <div>
              <Button onClick={onClickSelectFolder} id="select-folder-button">
                Select folder...
              </Button>
            </div>
          </div>
          <div>
            <Body>or</Body>
          </div> */}
          <div className={linkContainerStyles}>
            {/* <Label htmlFor="github-link-input" id="github-link-input-label">
              Enter a GitHub repository link
            </Label>
            <TextInput
              id="github-link-input"
              aria-labelledby="github-link-input-label"
              onChange={(e) => dispatch(setGithubLink(e.target.value))}
              value={githubLink || ''}
              placeholder="https://github.com/mongodb-js/compass"
            />
            {githubLink === null && (
              <Button
                className={autofillStyles}
                onClick={() =>
                  // dispatch(setGithubLink('git@github.com:Anemy/gravity.git'))
                  dispatch(
                    setGithubLink(
                      'git@github.com:Anemy/test-project-for-ai-code.git'
                    )
                  )
                }
              >
                autofill
              </Button>
            )} */}
            <Label htmlFor="github-link-input" id="github-link-input-label">
              Ask a question
            </Label>
            <TextInput
              id="github-link-input"
              aria-labelledby="github-link-input-label"
              onChange={(e) => dispatch(setGithubLink(e.target.value))}
              value={questionPrompt || ''}
              placeholder="What stage do I need to pull in data from another collection?"
            />
            {questionPrompt === null && (
              <Button
                className={autofillStyles}
                onClick={() =>
                  dispatch(
                    setQuestionPrompt(
                      'What stage do I need to pull in data from another collection?'
                    )
                  )
                }
              >
                autofill
              </Button>
            )}
            <div>
              <Body>or</Body>
            </div>
            <div className={analyzeWorkspaceContainerStyles}>
              <Button variant="primary" onClick={onClickAnalyzeCodebase}>
                Analyze workspace
              </Button>
            </div>

            {/* {githubLink !== null && (
              <div className={submitGithubLinkStyles}>
                <Button variant="primary" onClick={onClickSubmitGithubLink}>
                  Analyze
                </Button>
              </div>
            )} */}
            {/* {githubLink !== null && (
              <div className={submitGithubLinkStyles}>
                <Button variant="primary" onClick={onClickSubmitGithubLink}>
                  Next
                </Button>
              </div>
            )} */}
          </div>
        </div>
      </InputContainer>
    </div>
  );
};

export { SelectCodebase };
