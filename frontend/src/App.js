import { AuthProvider } from "./contexts/AuthContext";
import "./App.css";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import LandingPage from "./pages/landing";
import Authentication from "./pages/authentication";
import VideoMeet from "./pages/VideoMeet";
import History from "./pages/history";
import HomeComponent from "./pages/home";
import ProtectedRoute from "./utils/ProtectedRoute";

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Authentication />} />
          <Route path="/home" element={
           <ProtectedRoute>
           <HomeComponent />
            </ProtectedRoute>
            } />

          <Route path="/history" element={
          <ProtectedRoute>
          <History />
          </ProtectedRoute>
         } />

        <Route path="/meet/:roomId" element={<VideoMeet />} />

          </Routes>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
