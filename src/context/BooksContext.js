// BooksContext: list of books + currentBookId + book CRUD.
// Re-renders only when books list or currentBookId changes -- NOT on every
// transaction or account mutation.
import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import * as storage from '../utils/storage';
import { sanitizeBooks } from './sanitizers';

const BooksContext = createContext(null);

export function BooksProvider({ children }) {
  const [books, setBooks] = useState([]);
  const [currentBookId, setCurrentBookId] = useState('default');
  const [loaded, setLoaded] = useState(false);

  const initFromStorage = useCallback(async () => {
    const [booksData, currentBook] = await Promise.all([
      storage.getBooks(),
      storage.getCurrentBookId(),
    ]);
    setBooks(sanitizeBooks(booksData));
    setCurrentBookId(currentBook);
    setLoaded(true);
  }, []);

  const switchBook = useCallback(async (bookId) => {
    setCurrentBookId(bookId);
    await storage.setCurrentBookId(bookId);
  }, []);

  const createBook = useCallback(async (book) => {
    const updated = await storage.addBook(book);
    setBooks(sanitizeBooks(updated));
    return updated;
  }, []);

  const editBook = useCallback(async (id, updates) => {
    const updated = await storage.updateBook(id, updates);
    setBooks(sanitizeBooks(updated));
    return updated;
  }, []);

  const removeBook = useCallback(async (id) => {
    const updated = await storage.deleteBook(id);
    const next = sanitizeBooks(updated);
    setBooks(next);
    if (currentBookId === id && next.length > 0) {
      await switchBook(next[0].id);
    }
    return next;
  }, [currentBookId, switchBook]);

  const currentBook = books.find(b => b && b.id === currentBookId) || books[0] || null;

  const value = useMemo(() => ({
    books,
    currentBookId,
    currentBook,
    loaded,
    initFromStorage,
    switchBook,
    createBook,
    editBook,
    removeBook,
  }), [books, currentBookId, currentBook, loaded, initFromStorage, switchBook, createBook, editBook, removeBook]);

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks() {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error('useBooks must be used within BooksProvider');
  return ctx;
}
