import { EditorPage } from './pages/EditorPage';
import { SheetPage } from './pages/SheetPage';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  if (route.page === 'sheet') return <SheetPage key={route.link} link={route.link} />;
  // same element type for "#/" and "#/edit/…" so importing doesn't remount the editor
  return <EditorPage importLink={route.importLink} />;
}
