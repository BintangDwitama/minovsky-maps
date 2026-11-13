import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPage } from './ui/pages/EditorPage';
import './ui/styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorPage />
  </StrictMode>,
);
