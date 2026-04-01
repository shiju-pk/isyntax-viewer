import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Worklist from './pages/worklist/Worklist';
import ViewerPage from './pages/viewer/ViewerPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Worklist />} />
        <Route path="/view/:studyId" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
