import { Search, History, Star, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";

const categories = ["All", "Digital", "Physical", "Experiences", "Donations"];

const rewards = [
  {
    id: 1,
    name: "1-Month Streaming",
    points: 500,
    gradient: "from-rose-500 to-pink-600",
    available: true,
  },
  {
    id: 2,
    name: "Premium App Access",
    points: 800,
    gradient: "from-amber-500 to-orange-600",
    available: true,
  },
  {
    id: 3,
    name: "Digital Gift Card",
    points: 1000,
    gradient: "from-emerald-500 to-teal-600",
    available: true,
  },
  {
    id: 4,
    name: "Branded T-Shirt",
    points: 1500,
    gradient: "from-violet-500 to-purple-600",
    available: true,
  },
  {
    id: 5,
    name: "Guided Meditation",
    points: 4000,
    gradient: "from-indigo-500 to-blue-600",
    available: false,
  },
  {
    id: 6,
    name: "Tree Donation",
    points: 250,
    gradient: "from-green-500 to-emerald-600",
    available: true,
  },
  {
    id: 7,
    name: "Insulated Water Bottle",
    points: 1200,
    gradient: "from-cyan-500 to-blue-600",
    available: true,
  },
  {
    id: 8,
    name: "Concert Tickets",
    points: 5000,
    gradient: "from-red-500 to-rose-600",
    available: false,
  },
];

export function Store() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background">
        <Header
          title="Rewards Store"
          leftSlot={
            <button className="flex size-12 items-center justify-start text-text-secondary hover:text-primary transition-colors">
              <History className="w-5 h-5" />
            </button>
          }
          rightSlot={
            <button
              onClick={() => navigate("/rewards/new")}
              className="flex size-12 items-center justify-end text-text-secondary hover:text-primary transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          }
        />

        {/* Points Card */}
        <div className="p-4 pt-2">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4 border border-border">
            <div className="flex flex-col gap-1">
              <p className="text-text-secondary text-sm font-bold">
                Your Points
              </p>
              <p className="text-text-primary text-2xl font-bold">
                1,250 PTS
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center">
              <Star className="w-8 h-8 fill-current" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="flex items-center bg-surface rounded-xl px-4 h-12 border border-border">
            <Search className="w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search for rewards"
              className="flex-1 bg-transparent ml-2 text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat, index) => (
            <button
              key={cat}
              className={`h-10 shrink-0 px-4 rounded-lg text-sm font-medium transition-colors ${
                index === 0
                  ? "bg-primary text-white"
                  : "bg-surface text-text-primary border border-border hover:bg-surface-light"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rewards Grid */}
      <main className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {rewards.map((reward) => (
            <div key={reward.id} className="flex flex-col gap-2">
              <div
                className={`w-full aspect-square rounded-xl bg-gradient-to-br ${reward.gradient} ${
                  !reward.available ? "opacity-40" : ""
                }`}
              />
              <div>
                <p className="text-text-primary text-base font-medium">
                  {reward.name}
                </p>
                <p className="text-text-secondary text-sm">
                  {reward.points} PTS
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
