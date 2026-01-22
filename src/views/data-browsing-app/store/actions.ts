import { store } from './index';
import {
  startLoading,
  startRefresh,
  setCurrentPage,
  setItemsPerPage,
  stopLoading,
  selectTotalPages,
} from './documentQuerySlice';
import { sendGetDocuments, sendCancelRequest } from '../vscode-api';

const getState = () => store.getState().documentQuery;

export const refreshDocuments = (): void => {
  const { itemsPerPage } = getState();
  store.dispatch(startRefresh());
  sendGetDocuments(0, itemsPerPage);
};

export const fetchInitialDocuments = (): void => {
  const { itemsPerPage } = getState();
  sendGetDocuments(0, itemsPerPage);
};

export const goToPreviousPage = (): void => {
  const { currentPage, itemsPerPage } = getState();
  if (currentPage > 1) {
    const newPage = currentPage - 1;
    const skip = (newPage - 1) * itemsPerPage;
    store.dispatch(setCurrentPage(newPage));
    store.dispatch(startLoading());
    sendGetDocuments(skip, itemsPerPage);
  }
};

export const goToNextPage = (): void => {
  const { currentPage, itemsPerPage } = getState();
  const totalPages = selectTotalPages(store.getState());
  if (currentPage < totalPages) {
    const newPage = currentPage + 1;
    const skip = (newPage - 1) * itemsPerPage;
    store.dispatch(setCurrentPage(newPage));
    store.dispatch(startLoading());
    sendGetDocuments(skip, itemsPerPage);
  }
};

export const changeItemsPerPage = (newItemsPerPage: number): void => {
  store.dispatch(setItemsPerPage(newItemsPerPage));
  store.dispatch(setCurrentPage(1));
  store.dispatch(startLoading());
  sendGetDocuments(0, newItemsPerPage);
};

export const cancelRequest = (): void => {
  store.dispatch(stopLoading());
  sendCancelRequest();
};

export const adjustCurrentPage = (): void => {
  const { currentPage } = getState();
  const totalPages = selectTotalPages(store.getState());
  if (currentPage > totalPages && totalPages > 0) {
    store.dispatch(setCurrentPage(totalPages));
  }
};

