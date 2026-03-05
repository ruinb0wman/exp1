import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { Store } from "./pages/Store";
import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";

function Layout() {
  return (
    <div className="min-h-screen">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/store" element={<Store />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
