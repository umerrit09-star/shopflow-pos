CREATE TYPE public.app_role AS ENUM ('super_admin','owner','cashier');
CREATE TYPE public.shop_status AS ENUM ('active','held');

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  logo_url text,
  status public.shop_status NOT NULL DEFAULT 'active',
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.shop_active(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND status = 'active')
$$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL,
  sku text,
  category text,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_shop_idx ON public.products(shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cashier_id uuid,
  receipt_no bigserial,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  cash_received numeric(12,2) NOT NULL DEFAULT 0,
  change_due numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_shop_idx ON public.sales(shop_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "super admins manage all shops" ON public.shops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "staff read own shop" ON public.shops FOR SELECT TO authenticated
  USING (id = public.current_shop_id());
CREATE POLICY "owner updates own shop" ON public.shops FOR UPDATE TO authenticated
  USING (id = public.current_shop_id() AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (id = public.current_shop_id() AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR shop_id = public.current_shop_id() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "super admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "shop staff manage products" ON public.products FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id() AND public.shop_active(shop_id))
  WITH CHECK (shop_id = public.current_shop_id() AND public.shop_active(shop_id));
CREATE POLICY "super admins read products" ON public.products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "shop staff manage sales" ON public.sales FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id() AND public.shop_active(shop_id))
  WITH CHECK (shop_id = public.current_shop_id() AND public.shop_active(shop_id));
CREATE POLICY "super admins read sales" ON public.sales FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "shop staff manage sale items" ON public.sale_items FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id() AND public.shop_active(shop_id))
  WITH CHECK (shop_id = public.current_shop_id() AND public.shop_active(shop_id));
CREATE POLICY "super admins read sale items" ON public.sale_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER shops_touch BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();