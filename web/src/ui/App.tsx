import { useState } from 'react';
import { HttpAccountService } from '../infrastructure/httpAccountService';
import { LocalStoragePublicationStore } from '../infrastructure/localStoragePublicationStore';
import { AccountProvider } from './hooks/useAccount';
import { AccountNotice } from './organisms/AccountNotice';
import { EditorPage } from './pages/EditorPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { PublishedSheetPage } from './pages/PublishedSheetPage';
import { SheetPage } from './pages/SheetPage';
import { useRoute } from './router';

const buildAccountServices = () => ({
  accounts: new HttpAccountService(),
  publications: new LocalStoragePublicationStore(),
});

export function App() {
  const [services] = useState(buildAccountServices);
  return (
    <AccountProvider service={services.accounts} publications={services.publications}>
      <Page />
      <AccountNotice />
    </AccountProvider>
  );
}

function Page() {
  const route = useRoute();
  if (route.page === 'sheet') return <SheetPage key={route.link} link={route.link} />;
  if (route.page === 'privacy') return <PrivacyPage />;
  if (route.page === 'published') {
    return <PublishedSheetPage key={route.id} id={route.id} editToken={route.editToken} />;
  }
  // one element type for all editor routes, so imports don't remount the editor
  return <EditorPage importLink={route.importLink} publishedId={route.publishedId} />;
}
