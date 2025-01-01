import Sidebar from './layout/Sidebar';
import { Route, HashRouter, Routes } from 'react-router-dom';
import Editors from './pages/Editors';
import Projects from './pages/Projects';
import Settings from './pages/Settings';

function App() {
    return (
        <>
            <div className="overflow-hidden">
                <HashRouter>
                    <Sidebar />
                    <div className="px-6 py-2 ms-48">
                        <Routes>
                            <Route path="/" element={<Projects />} />
                            <Route path="/editors" element={<Editors />} />
                            <Route path="/settings" element={<Settings />} />
                        </Routes>
                    </div>
                </HashRouter>
            </div>
        </>
    )
}


export default App;