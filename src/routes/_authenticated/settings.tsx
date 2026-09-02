import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useSignedUrl } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Shop Settings — CloudCart" },
      {
        name: "description",
        content: "Update your CloudCart shop name, address, phone number and logo for receipts.",
      },
      { property: "og:title", content: "Shop Settings — CloudCart" },
      {
        property: "og:description",
        content: "Manage shop profile details and branding used across your POS and receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me, isLoading } = useMe();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEdit = me?.roles.includes("owner") ?? false;
  const logoUrl = useSignedUrl(logoPath);

  useEffect(() => {
    if (!me?.shop) return;
    setName(me.shop.name ?? "");
    setAddress(me.shop.address ?? "");
    setPhone(me.shop.phone ?? "");
    setLogoPath(me.shop.logo_url ?? null);
  }, [me?.shop]);

  async function uploadLogo(file: File) {
    if (!me?.shopId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${me.shopId}/logo/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("shop-assets").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLogoPath(path);
    toast.success("Logo uploaded — remember to save");
  }

  async function save() {
    if (!me?.shopId) return;
    if (!name.trim()) return toast.error("Shop name is required");
    setSaving(true);
    const { error } = await supabase
      .from("shops")
      .update({
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        logo_url: logoPath,
      })
      .eq("id", me.shopId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    toast.success("Shop settings saved");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  if (!me?.shop) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No shop is linked to this account.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">Shop settings</h1>
        <p className="text-sm text-muted-foreground">
          These details appear on your receipts and across the CloudCart app.
        </p>
      </header>

      {!canEdit && (
        <div className="rounded-xl border border-border bg-secondary/60 p-3 text-sm text-muted-foreground">
          Only the shop owner can change these settings.
        </div>
      )}

      <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary">
            {logoUrl ? (
              <img src={logoUrl} alt={`${name} logo`} className="size-full object-cover" />
            ) : (
              <Store className="size-7 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 size-4" />
              )}
              {logoPath ? "Replace logo" : "Upload logo"}
            </Button>
            <p className="text-xs text-muted-foreground">Square PNG or JPG works best.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop-name">Shop name</Label>
          <Input
            id="shop-name"
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
            placeholder="CloudCart Store"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop-address">Address</Label>
          <Input
            id="shop-address"
            value={address}
            disabled={!canEdit}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Shop 12, Main Boulevard, Lahore"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop-phone">Phone number</Label>
          <Input
            id="shop-phone"
            value={phone}
            disabled={!canEdit}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 300 1234567"
          />
        </div>

        <Button className="w-full sm:w-auto" disabled={!canEdit || saving || uploading} onClick={save}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </section>
    </div>
  );
}
