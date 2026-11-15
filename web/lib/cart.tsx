"use client";
// The cart lives in the browser (localStorage). Only checkout talks to the database.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CartLine } from "@marketplace/shared";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  total: number; // preview only; the server recomputes at checkout
  addLine: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load once on the client, then save on every change.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Reading localStorage must happen after hydration, so setting state in this effect is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setLines(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, loaded]);

  // Same key (product + same options) => add to the quantity. Different options => new line.
  function addLine(line: CartLine) {
    setLines((current) => {
      const existing = current.find((l) => l.key === line.key);
      if (existing) {
        return current.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l));
      }
      return [...current, line];
    });
  }

  function setQuantity(key: string, quantity: number) {
    setLines((current) =>
      current.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, Math.max(1, quantity)) } : l)),
    );
  }

  const value: CartContextValue = {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.reduce((sum, l) => sum + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100,
    addLine,
    setQuantity,
    removeLine: (key) => setLines((current) => current.filter((l) => l.key !== key)),
    clear: () => setLines([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
