import { Body } from '@leafygreen-ui/typography';
import Button from '@leafygreen-ui/button';
import React, { useCallback, useMemo } from 'react';
import Card from '@leafygreen-ui/card';
import { css } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';
import { useSelector, useDispatch } from 'react-redux';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import type { FileData } from 'react-diff-view';

import type { AppDispatch, RootState } from '../store/store';
import { generateSuggestions, setStatus } from '../store/codebase';
import { InputContainer } from '../components/input-container';
import CancelLoader from '../components/cancel-loader';

const containerStyles = css({
  padding: spacing[3],
});

const diffContainer = css({
  marginTop: spacing[3],
});

const cardStyles = css({
  marginTop: spacing[3],
});

const submitContainerStyles = css({
  marginTop: spacing[2],
  display: 'flex',
  justifyContent: 'flex-end',
});

function FileDiff({
  oldRevision,
  newRevision,
  type,
  hunks,
  newPath,
  oldPath,
}: FileData) {
  return (
    <div key={`${oldRevision}-${newRevision}`}>
      <Body weight="medium">
        {type === 'modify' && `Modify "${newPath}"`}
        {type === 'add' && `+ Add file "${newPath}"`}
        {type === 'rename' && `~ Rename file "${oldPath}" -> "${newPath}"`}
        {type === 'delete' && `- Delete file "${oldPath}"`}
      </Body>
      <Diff
        key={`${oldRevision}-${newRevision}`}
        viewType="split"
        diffType={type}
        hunks={hunks}
      >
        {(hunks) =>
          hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
        }
      </Diff>
    </div>
  );
}

// eslint-disable-next-line react/no-multi-comp
function ViewSuggestions() {
  const codebaseStatus = useSelector(
    (state: RootState) => state.codebase.status
  );
  const errorMessage = useSelector(
    (state: RootState) => state.codebase.errorMessage
  );
  const diffChanges = useSelector(
    (state: RootState) => state.codebase.diffChanges
  );
  const descriptionOfChanges = useSelector(
    (state: RootState) => state.codebase.descriptionOfChanges
  );
  const dispatch = useDispatch<AppDispatch>();

  const onClickBack = useCallback(() => {
    dispatch(setStatus('loaded'));
  }, []);

  const diffFiles = useMemo(() => {
    if (diffChanges) {
      return parseDiff(diffChanges);
    }
  }, [diffChanges]);

  return (
    <div className={containerStyles}>
      {codebaseStatus !== 'generating-suggestions' && (
        <Button onClick={onClickBack}>Back</Button>
      )}
      {codebaseStatus === 'generating-suggestions' && (
        <CancelLoader
          progressText="Generating suggestions"
          cancelText="Cancel"
          onCancel={onClickBack}
        />
      )}
      {diffChanges && (
        <>
          <Card className={cardStyles}>
            {/* <Body weight="medium">Summary of Changes</Body> */}
            <Body>
              Below is a diff of the proposed changes. {descriptionOfChanges}
            </Body>
            <div className={diffContainer}>
              {(diffFiles || []).map(FileDiff)}
            </div>
            <div className={submitContainerStyles}>
              <Button onClick={() => alert('coming soon')} variant="primary">
                Commit changes...
              </Button>
            </div>
          </Card>
          <InputContainer>
            <Button onClick={() => dispatch(generateSuggestions())}>
              Regenerate
            </Button>
          </InputContainer>
        </>
      )}
      {!!errorMessage && (
        <div>
          <Body>An error occured.</Body>
          <Button onClick={() => dispatch(generateSuggestions())}>Retry</Button>
        </div>
      )}
    </div>
  );
}

export { ViewSuggestions };
