// The cart lives on the device (AsyncStorage). Only checkout talks to the database.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CartLine } from '@marketplace/shared';

type CartValue = {
  lines: CartLine[];
  count: number;
  total: number; // preview only; the server recomputes at checkout
  addLine: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);
const STORAGE_KEY = 'cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => saved && setLines(JSON.parse(saved)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, loaded]);

  // Same key (product + same options) => add to the quantity. Different options => new line.
  function addLine(line: CartLine) {
    setLines((current) =>
      current.some((l) => l.key === line.key)
        ? current.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l))
        : [...current, line],
    );
  }

  const value: CartValue = {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.reduce((sum, l) => sum + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100,
    addLine,
    setQuantity: (key, quantity) =>
      setLines((c) => c.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, Math.max(1, quantity)) } : l))),
    removeLine: (key) => setLines((c) => c.filter((l) => l.key !== key)),
    clear: () => setLines([]),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
