import { createContext } from "react";
export const ThemeOverride = createContext<"light" | "dark" | null>(null);
export const BrandOverride = createContext<{
  brand: boolean;
  logo: boolean;
  brandName: string;
  brandSymbol: string;
  home?: {
    date: boolean;
    greeting: boolean;
    description: boolean;
    summary: boolean;
    title: string;
    subtitle: string;
  };
} | null>(null);
