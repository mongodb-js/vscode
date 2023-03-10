import { Body, Disclaimer, Label } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@leafygreen-ui/emotion';
// import TextInput from '@leafygreen-ui/text-input';
import { spacing } from '@leafygreen-ui/tokens';
// import { dialog } from '@electron/remote';
import { useSelector, useDispatch } from 'react-redux';
import TextArea from '@leafygreen-ui/text-area';
import Checkbox from '@leafygreen-ui/checkbox';
import Code from '@leafygreen-ui/code';
// import IconButton from '@leafygreen-ui/icon-button';
import Icon from '@leafygreen-ui/icon';
import useDimensions from 'react-use-dimensions';
import { MongoDBLogoMark } from '@leafygreen-ui/logo';

import {
  setIncludeSelectionInQuestion,
  askQuestion,
  setQuestionPrompt,
  clearAnswers,
} from '../store/question';
import type { AppDispatch, RootState } from '../store/store';
import { InputContainer } from '../components/input-container';
import CancelLoader from '../components/cancel-loader';
import { MESSAGE_TYPES } from '../../extension-app-message-constants';
import type { MESSAGE_FROM_EXTENSION_TO_WEBVIEW } from '../../extension-app-message-constants';
import { codeWrapSymbol } from '../../../../ai-code/constants';

const containerStyles = css({
  height: '100%',
  display: 'flex', // TODO: grid area instead of flex.
  flexDirection: 'column',
  justifyContent: 'flex-end',
});

const responseAreaStyles = css({
  // flexGrow: 1,
  padding: spacing[3],
  paddingTop: spacing[5],
  paddingBottom: spacing[1],
  // marginBottom: spacing[2],
  // height: '100%',
  // overflow: 'scroll',
  // display: 'flex',
  // flexDirection: 'column',
  // justifyContent: 'flex-end',
  overflow: 'scroll',

  // display: 'flex',
  // flexDirection: 'column',
  // justifyContent: 'flex-end',
});

const questionAreaStyles = css({
  padding: spacing[3],
  // height: '100px', // TODO: height.
});

// const topConversationStyles = css({
//   display: 'flex',
//   justifyContent: 'flex-end',
// });

const disclaimerStyles = css({
  // marginTop: spacing[1],
});

// const linkContainerStyles = css({
//   flexGrow: 1,
// });

const subsequentActionButtonStyles = css({
  marginTop: spacing[3],
  marginBottom: spacing[5],
  display: 'flex',
  gap: spacing[2],
  alignItems: 'center',
});

const clearHistoryStyles = css({
  // marginLeft: spacing[2],
});

const autofillContainerStyles = css({
  position: 'fixed',
  right: spacing[1],
  bottom: spacing[1],
});

const logoStyles = css({
  flexShrink: 0,
});

const loadingContainer = css({
  marginTop: spacing[5],
});

const autofillStyles = css({
  marginTop: spacing[1],
  // marginRight: spacing[2],
  marginLeft: spacing[2],
});

const answerTextContainer = css({
  marginBottom: spacing[1],
  gap: spacing[1],
  display: 'flex',
  // alignItems: 'center',
});

const questionTextStyles = css({
  flexGrow: 1,

  whiteSpace: 'pre-wrap',
});

const aboveInputContainerStyles = css({
  display: 'flex',
  alignItems: 'end',
  paddingBottom: spacing[1],
});

const inputContainerStyles = css({
  display: 'flex',
  alignItems: 'center',
  paddingBottom: spacing[1],
});

const textAreaStyles = css({
  flexGrow: 1,
});

const askButtonStyles = css({
  marginLeft: spacing[1],
  // flexShrink: 1,
});

const questionLabelContainerStyles = css({
  flexGrow: 1,
});

const codeSelectionContainerStyles = css({
  marginTop: spacing[2],
  // marginBottom: spacing[3],
  marginBottom: spacing[2],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[2],
});

const codeStyles = css({
  marginTop: spacing[2],
  // maxHeight: '200px',
  maxHeight: spacing[6],
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const inlineCodeStyles = css({
  maxHeight: spacing[6],
  // marginTop: spacing[1],
  margin: 0,

  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const sectionContainerStyles = css({
  marginTop: spacing[2],
  textAlign: 'center',
});

const answerResponseTextContainer = css({
  display: 'flex',
});

const answerTextStyles = css({
  whiteSpace: 'pre-wrap',
  paddingLeft: spacing[2],
  flexGrow: 1,
});

// eslint-disable-next-line complexity
const AIAssistant: React.FunctionComponent = () => {
  const questionPrompt = useSelector(
    (state: RootState) => state.question.questionPrompt
  );
  const isAskingQuestion = useSelector(
    (state: RootState) => state.question.isAskingQuestion
  );
  const answers = useSelector((state: RootState) => state.question.answers);
  const includeSelectionInQuestion = useSelector(
    (state: RootState) => state.question.includeSelectionInQuestion
  );
  const dispatch = useDispatch<AppDispatch>();

  const [codeSelection, updateCodeSelection] = useState<string>(() => '');
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

  const reAskQuestion = useCallback(() => {
    void dispatch(
      askQuestion({
        history: answers[answers.length - 1].history,
      })
    );
  }, [answers]);

  const onSubmitForm = useCallback(
    (e) => {
      void dispatch(
        askQuestion({
          history:
            answers.length > 1 ? answers[answers.length - 1].history : [],
          newMessage: {
            includeSelectionInQuestion,
            codeSelection,
          },
        })
      );
      e.preventDefault();
    },
    [includeSelectionInQuestion, codeSelection, answers]
  );

  const onKeyDownTextArea = useCallback(
    (e) => {
      if (!e.shiftKey && e.key === 'Enter') {
        void dispatch(
          askQuestion({
            history:
              answers.length > 1 ? answers[answers.length - 1].history : [],
            newMessage: {
              includeSelectionInQuestion,
              codeSelection,
            },
          })
        );
        e.preventDefault();
      }
    },
    [includeSelectionInQuestion, codeSelection, answers]
  );

  const hasLegitCodeSelection = codeSelection.trim().length > 0;

  const [inputAreaRef, { height: inputAreaHeight }] = useDimensions();
  const [totalAreaRef, { height: totalHeight }] = useDimensions();

  const responseAreaRef = useRef<null | HTMLDivElement>(null);
  const lastAnswersAmt = useRef(0);
  const lastIsAskingQuestion = useRef(isAskingQuestion);

  useEffect(() => {
    console.log('answers added to', responseAreaRef, responseAreaRef.current);
    if (responseAreaRef.current) {
      if (
        (answers.length > 0 && answers.length !== lastAnswersAmt.current) ||
        lastIsAskingQuestion.current !== isAskingQuestion
      ) {
        lastAnswersAmt.current = answers.length;
        lastIsAskingQuestion.current = isAskingQuestion;
        // objDiv. = objDiv.scrollHeight;
        responseAreaRef.current.scrollTop =
          responseAreaRef.current.scrollHeight;
      }
    }
  }, [isAskingQuestion, answers]);

  // const inputAreaRef = useRef<null | HTMLDivElement>(null);
  // const [inputAreaDimensions, setInputAreaDimensions] = useState({
  //   height: window.innerHeight - 200,
  //   width: window.innerWidth - 200,
  // });

  // useLayoutEffect(() => {
  //   setInputAreaDimensions({
  //     height: inputAreaRef.current.clientHeight,
  //     width: inputAreaRef.current.clientWidth
  //   });
  // }, []);
  const [responseAreaHeight, setResponseAreaHeight] = useState(100);

  useEffect(() => {
    let newHeight = Math.max(
      10,
      totalHeight - inputAreaHeight - spacing[2] * 2
    );
    if (isNaN(newHeight)) {
      newHeight = 100;
    }
    setResponseAreaHeight(newHeight);
  }, [responseAreaHeight, inputAreaHeight, totalHeight]);

  return (
    <div className={containerStyles} ref={totalAreaRef}>
      <div
        className={responseAreaStyles}
        style={{
          height: responseAreaHeight,
        }}
        ref={responseAreaRef}
      >
        {answers.length > 0 && (
          <>
            {/* <div className={topConversationStyles}>
              <IconButton
                aria-label="Clear"
                title="Clear"
                onClick={() => dispatch(clearAnswers())}
              >
                <Icon glyph="X" />
              </IconButton>
            </div> */}
            {answers.map((answer) => (
              <InputContainer key={answer.id}>
                <div className={answerTextContainer}>
                  <Icon
                    glyph="ChevronRight"
                    size="large"
                    className={logoStyles}
                  />
                  {/* <Body weight="medium" className={questionTextStyles}>
                    {answer.questionText}
                  </Body> */}
                  <div className={questionTextStyles}>
                    {answer.questionText
                      .trim()
                      .split(codeWrapSymbol)
                      .map((questionText, index) =>
                        index > 0 && index % 2 === 1 ? (
                          <Code
                            // TODO: Languages
                            className={inlineCodeStyles}
                            language="javascript"
                            // copyable={false}
                            copyable
                          >
                            {questionText}
                          </Code>
                        ) : (
                          <Body weight="medium">{questionText}</Body>
                        )
                      )}
                  </div>
                  {/* <IconButton
                    aria-label="Clear"
                    title="Clear"
                    onClick={() => dispatch(clearAnswers())}
                  >
                    <Icon glyph="X" />
                  </IconButton> */}
                </div>
                <div className={answerResponseTextContainer}>
                  <MongoDBLogoMark
                    height={spacing[5]}
                    color="green-base"
                    className={logoStyles}
                  />
                  <div className={answerTextStyles}>
                    {answer.text
                      .split(codeWrapSymbol)
                      .map((answerText, index) =>
                        index > 0 && index % 2 === 1 ? (
                          <Code
                            // TODO: Languages
                            className={inlineCodeStyles}
                            language="javascript"
                            // copyable={false}
                            copyable
                          >
                            {answerText}
                          </Code>
                        ) : (
                          <Body>{answerText}</Body>
                        )
                      )}
                  </div>
                  {/* codeWrapSymbol or '```' */}
                  {/* inlineCodeStyles */}
                  {/* <Body className={answerTextStyles}>{answer.text}</Body> */}
                </div>
              </InputContainer>
            ))}
            <div className={subsequentActionButtonStyles}>
              <Button
                variant="primaryOutline"
                leftGlyph={<Icon glyph="Refresh" />}
                onClick={reAskQuestion}
                // size="large"
              >
                Ask again
              </Button>
              <Button
                // variant="defaultOutline"
                // variant="primaryOutline"
                className={clearHistoryStyles}
                onClick={() => dispatch(clearAnswers())}
                // size="large"
              >
                Clear
              </Button>
            </div>
          </>
        )}

        {isAskingQuestion && (
          <>
            <div className={answerTextContainer}>
              <Icon glyph="ChevronRight" size="large" />
              <Body
                weight="medium"
                // className={questionTextStyles}
              >
                {isAskingQuestion}
              </Body>
            </div>
            <div className={sectionContainerStyles}>
              <div className={loadingContainer}>
                <CancelLoader
                  progressText="Asking question"
                  cancelText="Cancel"
                  onCancel={() => {
                    /* todo */
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <form
        ref={inputAreaRef}
        className={questionAreaStyles}
        onSubmit={onSubmitForm}
      >
        {hasLegitCodeSelection && (
          <div className={codeSelectionContainerStyles}>
            <Checkbox
              onChange={() =>
                dispatch(
                  setIncludeSelectionInQuestion(!includeSelectionInQuestion)
                )
              }
              // type="checkbox"
              label="Include active selection with question"
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
                {/* TODO: Breakdown the message, highlight keywords, code, etc. */}
                {codeSelection}
              </Code>
            )}
          </div>
        )}
        {/* TODO: Is there a hotkey for swapping two variable names? */}
        <div className={aboveInputContainerStyles}>
          <div className={questionLabelContainerStyles}>
            <Label htmlFor="question-textarea" id="question-textarea-label">
              Ask a question
            </Label>
            {/* {!hasLegitCodeSelection && ( */}
            <Disclaimer className={disclaimerStyles}>
              Select code in the editor to reference it with your question.
            </Disclaimer>
          </div>
          {/* {!isAskingQuestion && !!questionPrompt && ( */}
          <div className={sectionContainerStyles}>
            <Button
              className={askButtonStyles}
              disabled={!!(isAskingQuestion || !questionPrompt)}
              variant="primary"
              type="submit"
            >
              Ask
            </Button>
          </div>
          {/* )} */}
        </div>
        <div className={inputContainerStyles}>
          <TextArea
            id="question-textarea"
            style={{
              width: 'initial',
            }}
            className={textAreaStyles}
            aria-labelledby="question-textarea-label"
            onChange={(e) => dispatch(setQuestionPrompt(e.target.value))}
            onKeyDown={onKeyDownTextArea}
            value={questionPrompt || ''}
            placeholder="What is the name of the stage that pulls data from another collection?"
          />
          {/* <Button
            className={askButtonStyles}
            variant="primary"
            type="submit"
            size="large"
            // size="large"
          >
            <Icon glyph="MagnifyingGlass"/>
          </Button> */}
        </div>
      </form>
      {!questionPrompt && (
        <div className={autofillContainerStyles}>
          <Button
            className={autofillStyles}
            onClick={() =>
              dispatch(
                setQuestionPrompt(
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
              dispatch(setQuestionPrompt('What does this database call do?'))
            }
          >
            autofill 2
          </Button>
          {/* What would that look like if we also add a bookNumber field thats a random integer between 1 and 10? */}
        </div>
      )}
    </div>
  );
};

export { AIAssistant };
