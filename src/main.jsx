import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <p>Built with React + Vite</p>;
}

const root = document.querySelector('#react-root');

if (root) {
  createRoot(root).render(<App />);
}
