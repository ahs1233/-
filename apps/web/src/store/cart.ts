"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  productId: string;
  variantId: string;
  slug: string;
  title: string;
  variantLabel: string; // وصف الخيار، مثل "المقاس: L"
  unitPrice: number;
  image: string | null;
  vendorId: string;
  vendorName: string;
  quantity: number;
  maxAvailable: number;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            const quantity = Math.min(existing.quantity + qty, line.maxAvailable);
            return {
              lines: state.lines.map((l) => (l.variantId === line.variantId ? { ...l, quantity, maxAvailable: line.maxAvailable } : l)),
            };
          }
          return { lines: [...state.lines, { ...line, quantity: Math.min(qty, line.maxAvailable) }] };
        }),
      setQty: (variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(0, Math.min(qty, l.maxAvailable)) } : l))
            .filter((l) => l.quantity > 0),
        })),
      remove: (variantId) => set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    }),
    { name: "al-souq-cart" },
  ),
);
