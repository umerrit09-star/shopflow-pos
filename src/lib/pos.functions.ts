import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeUsername, usernameToEmail } from "@/lib/username";

/**
 * Provisions the signed-in user: the very first account becomes the platform
 * super admin, everyone else gets their own shop (tenant) + owner role.
 */
export const bootstrapAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, shop_id")
      .eq("id", userId)
      .maybeSingle();
    if (existing) return { created: false };

    const claims = context.claims as {
      email?: string;
      user_metadata?: { shop_name?: string; full_name?: string };
    };
    const meta = claims.user_metadata ?? {};

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");

    if (!count) {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        full_name: meta.full_name ?? claims.email ?? "Super Admin",
      });
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "super_admin" });
      return { created: true, role: "super_admin" as const };
    }

    const { data: shop, error: shopError } = await supabaseAdmin
      .from("shops")
      .insert({ name: meta.shop_name?.trim() || "My Shop", owner_id: userId })
      .select("id")
      .single();
    if (shopError) throw shopError;

    await supabaseAdmin.from("profiles").insert({
      id: userId,
      shop_id: shop.id,
      full_name: meta.full_name ?? claims.email ?? "Shop Owner",
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "owner" });
    return { created: true, role: "owner" as const };
  });

const CreateShopInput = z.object({
  shopName: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  ownerName: z.string().optional(),
});

async function assertSuperAdmin(supabase: { rpc: unknown }, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

/** Super admin: create a brand new shop tenant with its own owner login. */
export const createShopAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateShopInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertSuperAdmin(context.supabase, context.userId);

    const username = normalizeUsername(data.username);
    if (username.length < 3) throw new Error("Username must be at least 3 characters (letters, numbers, . _ -)");

    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: data.password,
      email_confirm: true,
      user_metadata: { shop_name: data.shopName, full_name: data.ownerName ?? data.shopName, username },
    });
    if (userError || !created.user) {
      const message = userError?.message ?? "Could not create login";
      throw new Error(/already/i.test(message) ? "That username is already taken" : message);
    }

    const { data: shop, error: shopError } = await admin
      .from("shops")
      .insert({ name: data.shopName, owner_id: created.user.id })
      .select("id")
      .single();
    if (shopError) throw shopError;

    await admin
      .from("profiles")
      .upsert({ id: created.user.id, shop_id: shop.id, full_name: data.ownerName ?? data.shopName });
    await admin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "owner" }, { onConflict: "user_id,role" });

    return { shopId: shop.id };
  });

/** Super admin: permanently delete a shop tenant and all of its logins. */
export const deleteShopAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ shopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertSuperAdmin(context.supabase, context.userId);

    const { data: staff } = await admin.from("profiles").select("id").eq("shop_id", data.shopId);
    await admin.from("shops").delete().eq("id", data.shopId);
    for (const person of staff ?? []) {
      await admin.auth.admin.deleteUser(person.id);
    }
    return { ok: true };
  });

const RecognizeInput = z.object({
  imageDataUrl: z.string().min(32),
});

/** AI vision: identify which of the shop's products is in the photo. */
export const recognizeProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecognizeInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const { data: products, error } = await context.supabase
      .from("products")
      .select("id, title, sku, category, selling_price")
      .limit(300);
    if (error) throw error;
    if (!products?.length) return { productId: null, label: null, reason: "No products in inventory" };

    const catalog = products
      .map((p) => `${p.id} | ${p.title}${p.sku ? ` | SKU ${p.sku}` : ""}${p.category ? ` | ${p.category}` : ""}`)
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify retail products from a photo and match them to a shop catalog. " +
              "Reply with strict JSON only: {\"product_id\": string|null, \"label\": string, \"confidence\": number}. " +
              "product_id MUST be one of the given ids, or null when nothing matches.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Catalog (id | title | sku | category):\n${catalog}` },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("AI is busy right now — please try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted. Add credits to keep using recognition.");
      throw new Error(`AI recognition failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let parsed: { product_id?: string | null; label?: string; confidence?: number } = {};
    try {
      parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    } catch {
      parsed = {};
    }

    const match = products.find((p) => p.id === parsed.product_id);
    return {
      productId: match?.id ?? null,
      label: parsed.label ?? match?.title ?? null,
      reason: match ? null : "No confident match in your inventory",
    };
  });
