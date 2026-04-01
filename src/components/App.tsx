import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Worklist from './Worklist/Worklist';
import ViewerPage from './Viewer/ViewerPage';

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
