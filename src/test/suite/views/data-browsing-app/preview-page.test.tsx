import React from 'react';
import { expect } from 'chai';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sinon from 'sinon';
import PreviewPage from '../../../../views/data-browsing-app/preview-page';
import vscode from '../../../../views/data-browsing-app/vscode-api';
import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';

describe('PreviewPage test suite', function () {
  afterEach(function () {
    Sinon.restore();
  });

  it('should render the preview page with toolbar', function () {
    render(<PreviewPage />);
    expect(screen.getByLabelText('Insert Document')).to.exist;
    expect(screen.getByLabelText(/Sort order/)).to.exist;
    expect(screen.getByLabelText(/Items per page/)).to.exist;
  });

  it('should request documents on mount', function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(<PreviewPage />);

    expect(postMessageStub).to.have.been.calledWith({
      command: PreviewMessageType.getDocuments,
    });
  });

  it('should display loading state initially', function () {
    render(<PreviewPage />);
    expect(screen.getByText('Loading documents...')).to.exist;
  });

  it('should display documents when loaded', async function () {
    render(<PreviewPage />);

    // Simulate receiving documents from extension
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: PreviewMessageType.loadDocuments,
          documents: [
            { _id: '1', name: 'Test Document 1' },
            { _id: '2', name: 'Test Document 2' },
          ],
          totalCount: 2,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).to.not.exist;
    });
  });

  it('should send refresh request when refresh button is clicked', async function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(<PreviewPage />);

    // Wait for initial load to complete
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: PreviewMessageType.loadDocuments,
          documents: [],
          totalCount: 0,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).to.not.exist;
    });

    const refreshButton = screen.getByTitle('Refresh');
    await userEvent.click(refreshButton);

    expect(postMessageStub).to.have.been.calledWith({
      command: PreviewMessageType.refreshDocuments,
    });
  });

  it('should send sort request when sort option changes', async function () {
    const postMessageStub = Sinon.stub(vscode, 'postMessage');
    render(<PreviewPage />);

    // Wait for initial load
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: PreviewMessageType.loadDocuments,
          documents: [],
          totalCount: 0,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).to.not.exist;
    });

    const sortSelect = screen.getByLabelText(/Sort order/);
    await userEvent.click(sortSelect);

    const ascOption = screen.getByText('Ascending');
    await userEvent.click(ascOption);

    expect(postMessageStub).to.have.been.calledWith({
      command: PreviewMessageType.sortDocuments,
      sort: 'asc',
    });
  });

  it('should display "No documents to display" when there are no documents', async function () {
    render(<PreviewPage />);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: PreviewMessageType.loadDocuments,
          documents: [],
          totalCount: 0,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('No documents to display')).to.exist;
    });
  });

  it('should handle pagination correctly', async function () {
    const documents = Array.from({ length: 25 }, (_, i) => ({
      _id: `${i + 1}`,
      name: `Document ${i + 1}`,
    }));

    render(<PreviewPage />);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: PreviewMessageType.loadDocuments,
          documents,
          totalCount: 25,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).to.not.exist;
    });

    // Should show first 10 documents by default
    expect(screen.getByText('1-10 of 25')).to.exist;

    // Click next page
    const nextButton = screen.getByLabelText('Next page');
    await userEvent.click(nextButton);

    expect(screen.getByText('11-20 of 25')).to.exist;
  });
});
