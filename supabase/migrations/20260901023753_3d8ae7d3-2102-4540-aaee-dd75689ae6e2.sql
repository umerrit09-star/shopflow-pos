REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_shop_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shop_active(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;