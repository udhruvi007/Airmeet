import { AuthProvider } from "./contexts/AuthContext";
import './App.css';
import {Route, BrowserRouter as Router, Routes } from "react-router-dom";
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
 

function App() {
  return (
    <div className="App">

      <Router>
      
      <AuthProvider>

        <Routes>
        <Route path='' element={<LandingPage />} />
        <Route path='/auth' element={<Authentication />} />
      </Routes>
    </AuthProvider>
    </Router>
    </div> 

  );
}

export default App;
