import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "owner" | "cashier";

export type Me = {
  userId: string;
  email: string | null;
  fullName: string | null;
  shopId: string | null;
  roles: AppRole[];
  shop: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
    status: "active" | "held";
  } | null;
};

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("shop_id, full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      let shop: Me["shop"] = null;
      if (profile?.shop_id) {
        const { data } = await supabase
          .from("shops")
          .select("id, name, address, phone, logo_url, status")
          .eq("id", profile.shop_id)
          .maybeSingle();
        shop = (data as Me["shop"]) ?? null;
      }

      return {
        userId: user.id,
        email: user.email ?? null,
        fullName: profile?.full_name ?? null,
        shopId: profile?.shop_id ?? null,
        roles: (roles ?? []).map((r) => r.role as AppRole),
        shop,
      };
    },
    staleTime: 30_000,
  });
}

/** Resolves a private storage path in the shop-assets bucket to a signed URL. */
export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith("http") || path.startsWith("data:")) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from("shop-assets")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.assign("/auth");
  };
}
