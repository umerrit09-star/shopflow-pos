import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  shop_id: string;
  title: string;
  sku: string | null;
  category: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  image_url: string | null;
};

export function useProducts(shopId: string | null | undefined) {
  return useQuery<Product[]>({
    queryKey: ["products", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, shop_id, title, sku, category, cost_price, selling_price, stock_quantity, image_url")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export type SaleRow = {
  id: string;
  receipt_no: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cash_received: number;
  change_due: number;
  created_at: string;
};

export function useSales(shopId: string | null | undefined, limit = 200) {
  return useQuery<SaleRow[]>({
    queryKey: ["sales", shopId, limit],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, receipt_no, subtotal, discount, tax, total, cash_received, change_due, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    },
  });
}

export type SoldItem = {
  title: string;
  quantity: number;
  line_total: number;
  created_at: string;
};

export function useSoldItems(shopId: string | null | undefined) {
  return useQuery<SoldItem[]>({
    queryKey: ["sale_items", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("title, quantity, line_total, sales!inner(created_at)")
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const r = row as unknown as {
          title: string;
          quantity: number;
          line_total: number;
          sales: { created_at: string };
        };
        return {
          title: r.title,
          quantity: r.quantity,
          line_total: Number(r.line_total),
          created_at: r.sales.created_at,
        };
      });
    },
  });
}
