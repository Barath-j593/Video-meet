import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Meeting from "./pages/Meeting";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResumeScreening from "./components/ResumeScreening"; // ← ADD THIS

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meet/:roomId"
            element={
              <ProtectedRoute>
                <Meeting />
              </ProtectedRoute>
            }
          />

          {/* ← ADD THIS — Resume Filter (protected) */}
          <Route
            path="/resumefilter"
            element={
              <ProtectedRoute>
                <ResumeScreening />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}