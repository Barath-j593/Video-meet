import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Meeting from "./pages/Meeting";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/meet/:roomId" element={<Meeting />} />
      </Routes>
    </BrowserRouter>
  );
}
