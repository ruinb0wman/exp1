import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { AllTasks } from "./pages/AllTasks";
import { EditTask } from "./pages/EditTask";
import { Store } from "./pages/Store";
import { EditReward } from "./pages/EditReward";
import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";
import { PointsHistory } from "./pages/PointsHistory";
import { Backpack } from "./pages/Backpack";

function Layout() {
  return (
    <div className="min-h-screen-safe pt-safe">
      <Outlet />
      <BottomNav />
    </div>
  );
}

function SimpleLayout() {
  return (
    <div className="min-h-screen-safe pt-safe">
      <Outlet />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main layout with bottom navigation */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/store" element={<Store />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Simple layout without bottom navigation */}
        <Route element={<SimpleLayout />}>
          <Route path="/tasks" element={<AllTasks />} />
          <Route path="/tasks/new" element={<EditTask />} />
          <Route path="/tasks/:id" element={<EditTask />} />
          <Route path="/rewards/new" element={<EditReward />} />
          <Route path="/rewards/:id" element={<EditReward />} />
          <Route path="/points-history" element={<PointsHistory />} />
          <Route path="/backpack" element={<Backpack />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
