import { EditorPage } from './pages/EditorPage';
import { PublishedSheetPage } from './pages/PublishedSheetPage';
import { SheetPage } from './pages/SheetPage';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  if (route.page === 'sheet') return <SheetPage key={route.link} link={route.link} />;
  if (route.page === 'published') {
    return <PublishedSheetPage key={route.id} id={route.id} editToken={route.editToken} />;
  }
  // one element type for all editor routes, so imports don't remount the editor
  return <EditorPage importLink={route.importLink} publishedId={route.publishedId} />;
}
