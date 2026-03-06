import { useState } from "react";
import { Header } from "../components/Header";
import { RadioGroup } from "../components/RadioGroup";
import { Package } from "lucide-react";

const restockOptions = ["None", "Daily", "Weekly", "Monthly"];
const restockValues = ["none", "daily", "weekly", "monthly"] as const;

export function EditReward() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [pointCost, setPointCost] = useState("");
  const [restockCycleIndex, setRestockCycleIndex] = useState(0);
  const [limitedStock, setLimitedStock] = useState(true);
  const [inventoryQuantity, setInventoryQuantity] = useState("10");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleImageUpload = () => {
    // TODO: Implement actual image upload
    // For now, just set a placeholder
    setImageUrl("placeholder");
  };

  const handleSubmit = () => {
    // TODO: Submit reward data
    console.log({
      productName,
      description,
      pointCost: parseInt(pointCost) || 0,
      restockCycle: restockValues[restockCycleIndex],
      limitedStock,
      inventoryQuantity: limitedStock ? parseInt(inventoryQuantity) || 0 : null,
      imageUrl,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header
        title="Add New Product"
        back
        rightSlot={
          <button
            onClick={handleSubmit}
            className="text-primary text-base font-bold leading-normal tracking-[0.015em] shrink-0 hover:text-primary-light transition-colors"
          >
            Save
          </button>
        }
      />

      <main className="flex flex-1 flex-col p-4 gap-6">
        {/* Image Uploader */}
        <div
          onClick={handleImageUpload}
          className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border px-6 py-10 cursor-pointer hover:border-primary/50 transition-colors"
        >
          {imageUrl ? (
            <div className="w-24 h-24 rounded-xl bg-primary/20 flex items-center justify-center">
              <Package className="w-12 h-12 text-primary" />
            </div>
          ) : (
            <>
              <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
                <p className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
                  Upload Product Image
                </p>
                <p className="text-text-secondary text-sm font-normal leading-normal">
                  Tap to add an image for your new product.
                </p>
              </div>
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary/20 text-primary text-sm font-bold leading-normal tracking-[0.015em]">
                <span className="truncate">Upload Image</span>
              </button>
            </>
          )}
        </div>

        {/* Core Information Section */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col w-full">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Product Name
            </p>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name"
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border bg-surface focus:border-primary h-14 placeholder:text-text-muted p-[15px] text-base font-normal leading-normal"
            />
          </label>

          <label className="flex flex-col w-full">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Description
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a detailed description"
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border bg-surface focus:border-primary min-h-36 placeholder:text-text-muted p-[15px] text-base font-normal leading-normal"
            />
          </label>

          <label className="flex flex-col w-full">
            <p className="text-text-primary text-base font-medium leading-normal pb-2">
              Point Cost
            </p>
            <input
              type="number"
              value={pointCost}
              onChange={(e) => setPointCost(e.target.value)}
              placeholder="e.g., 500"
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border bg-surface focus:border-primary h-14 placeholder:text-text-muted p-[15px] text-base font-normal leading-normal [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
        </div>

        {/* Restock Cycle Section */}
        <div className="flex flex-col gap-4">
          <p className="text-text-primary text-base font-medium leading-normal">
            Restock Cycle
          </p>
          <RadioGroup
            list={restockOptions}
            value={restockCycleIndex}
            onChange={setRestockCycleIndex}
          />
        </div>

        {/* Limited Stock Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-text-primary text-base font-medium leading-normal">
              Limited Stock
            </p>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={limitedStock}
                onChange={(e) => setLimitedStock(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-surface after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-text-primary after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30" />
            </label>
          </div>

          {limitedStock && (
            <label className="flex flex-col w-full">
              <p className="text-text-primary text-base font-medium leading-normal pb-2">
                Inventory Quantity
              </p>
              <input
                type="number"
                value={inventoryQuantity}
                onChange={(e) => setInventoryQuantity(e.target.value)}
                placeholder="e.g., 10"
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border bg-surface focus:border-primary h-14 placeholder:text-text-muted p-[15px] text-base font-normal leading-normal [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
          )}
        </div>

        {/* Spacer to push button to bottom */}
        <div className="flex-grow min-h-8"></div>

        {/* Add Product Button */}
        <div className="py-2">
          <button
            onClick={handleSubmit}
            className="flex w-full min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-4 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary-light transition-colors shadow-lg shadow-primary/30"
          >
            <span className="truncate">Add Product</span>
          </button>
        </div>
      </main>
    </div>
  );
}
