import { Body, Disclaimer, Label } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import React, { useEffect, useState } from 'react';
import { css } from '@leafygreen-ui/emotion';
// import TextInput from '@leafygreen-ui/text-input';
import { spacing } from '@leafygreen-ui/tokens';
// import { dialog } from '@electron/remote';
import { useSelector, useDispatch } from 'react-redux';
import TextArea from '@leafygreen-ui/text-area';
import Checkbox from '@leafygreen-ui/checkbox';
import Code from '@leafygreen-ui/code';

import // loadCodebase,
// setDirectory,
// setGithubLink,
// setUseGithubLink,
'../store/codebase';
import {
  setIncludeSelectionInQuestion,
  askQuestion,
  setQuestionPrompt,
} from '../store/question';
import type { AppDispatch, RootState } from '../store/store';
import { InputContainer } from '../components/input-container';
import CancelLoader from '../components/cancel-loader';
import { MESSAGE_TYPES } from '../../extension-app-message-constants';
import type { MESSAGE_FROM_EXTENSION_TO_WEBVIEW } from '../../extension-app-message-constants';

const containerStyles = css({
  padding: spacing[3],
  // width: '100%',
  paddingTop: 0,
  // display: 'flex',
});

const optionsContainerStyles = css({
  // display: 'flex',
  // flexDirection: 'row',
  // gap: spacing[3],
});

const disclaimerStyles = css({
  marginTop: spacing[1],
});

const linkContainerStyles = css({
  flexGrow: 1,
});

const autofillStyles = css({
  marginTop: spacing[1],
  marginRight: spacing[2],
});

// const submitGithubLinkStyles = css({
//   marginTop: spacing[2],
//   display: 'flex',
//   justifyContent: 'flex-end',
// });

// const leftAlignStyles = css({
//   textAlign: 'left',
// });

const codeSelectionContainerStyles = css({
  // padding: spacing[2],
  marginTop: spacing[2],
  marginBottom: spacing[3],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
  // maxHeight: '200px',
  // overflow: 'hidden',
  // textOverflow: 'ellipsis',
  // whiteSpace: 'nowrap',
  // background
});

const codeStyles = css({
  marginTop: spacing[2],
  maxHeight: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const sectionContainerStyles = css({
  marginTop: spacing[2],
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
    (state: RootState) => state.question.questionPrompt
  );
  const isAskingQuestion = useSelector(
    (state: RootState) => state.question.isAskingQuestion
  );
  const questionResponse = useSelector(
    (state: RootState) => state.question.questionResponse
  );
  const includeSelectionInQuestion = useSelector(
    (state: RootState) => state.question.includeSelectionInQuestion
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

  const [codeSelection, updateCodeSelection] = useState<string>(() => '');
  //  CodeSelectionUpdatedMessage
  useEffect(() => {
    function handlePossibleCodeSelectionMessageFromExtension(event) {
      const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;

      switch (message.command) {
        case MESSAGE_TYPES.CODE_SELECTION_UPDATED:
          updateCodeSelection(message.selectedText);
          return;
        default:
          // No-op.
          return;
      }
    }

    window.addEventListener(
      'message',
      handlePossibleCodeSelectionMessageFromExtension
    );

    return () => {
      window.removeEventListener(
        'message',
        handlePossibleCodeSelectionMessageFromExtension
      );
    };
  }, []);

  // const onClickAnalyzeCodebase = useCallback(() => {
  //   void dispatch(loadCodebase());
  // }, []);

  const hasLegitCodeSelection = codeSelection.trim().length > 0;

  return (
    <div className={containerStyles}>
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
            <TextArea
              id="github-link-input"
              style={{
                width: 'initial',
              }}
              aria-labelledby="github-link-input-label"
              onChange={(e) => dispatch(setQuestionPrompt(e.target.value))}
              value={questionPrompt || ''}
              placeholder="What is the name of the stage that pulls data from another collection?"
              // placeholder="What stage do I need to pull in data from another collection?"
            />
            {!hasLegitCodeSelection && (
              <Disclaimer className={disclaimerStyles}>
                Select code in the editor to reference it with your question.
              </Disclaimer>
            )}
            {questionPrompt === null && (
              <>
                <Button
                  className={autofillStyles}
                  onClick={() =>
                    dispatch(
                      setQuestionPrompt(
                        // 'What stage do I need to pull in data from another collection?'
                        'What is the name of the stage that pulls data from another collection?'
                      )
                    )
                  }
                >
                  autofill
                </Button>
                <Button
                  className={autofillStyles}
                  onClick={() =>
                    dispatch(
                      setQuestionPrompt('What does this database call do?')
                    )
                  }
                >
                  autofill 2
                </Button>
              </>
            )}
            {hasLegitCodeSelection && (
              <div className={codeSelectionContainerStyles}>
                <Checkbox
                  // className={checkboxStyles}
                  onChange={() =>
                    dispatch(
                      setIncludeSelectionInQuestion(!includeSelectionInQuestion)
                    )
                  }
                  label="Include active selection"
                  checked={includeSelectionInQuestion}
                  bold={false}
                />
                {/* TODO: More languages than javascript */}
                {includeSelectionInQuestion && (
                  <Code
                    className={codeStyles}
                    language="javascript"
                    copyable={false}
                  >
                    {/* TODO: Code highlight? */}
                    {codeSelection}
                  </Code>
                )}
              </div>
            )}

            {!questionResponse && !isAskingQuestion && (
              <>
                {!!questionPrompt && (
                  <div className={sectionContainerStyles}>
                    <Button
                      variant="primary"
                      onClick={() => {
                        void dispatch(
                          askQuestion({
                            includeSelectionInQuestion,
                            codeSelection,
                          })
                        );
                      }}
                      size="large"
                    >
                      Ask
                    </Button>
                  </div>
                )}
                {/*
                <div className={sectionContainerStyles}>
                  <Body>or</Body>
                </div>
                <div className={sectionContainerStyles}>
                  <Body
                    className={leftAlignStyles}
                    weight="medium"
                  >
                    Let the ai write code for you. First it analyzes your workspace, with that context it can explain, refactor, and even generate code in your files.
                  </Body>
                </div>
                <div className={sectionContainerStyles}>
                  <Button
                    variant="primary"
                    onClick={onClickAnalyzeCodebase}
                  >
                    Analyze workspace
                  </Button>
                </div> */}
              </>
            )}

            {isAskingQuestion && (
              <div className={sectionContainerStyles}>
                <CancelLoader
                  progressText="Asking question"
                  cancelText="Cancel"
                  onCancel={() => {
                    /* todo */
                  }}
                />
              </div>
            )}

            {!!questionResponse && (
              <>
                <InputContainer>
                  <Body weight="medium">Answer</Body>
                  <Body>{questionResponse}</Body>
                </InputContainer>
                <div className={sectionContainerStyles}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void dispatch(
                        askQuestion({
                          includeSelectionInQuestion,
                          codeSelection,
                        })
                      );
                    }}
                    size="large"
                  >
                    Ask again
                  </Button>
                </div>
              </>
            )}

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
