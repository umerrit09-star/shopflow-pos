GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_shop_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_active(uuid) TO authenticated;

CREATE POLICY "shop staff read own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-assets' AND ((storage.foldername(name))[1] = public.current_shop_id()::text OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "shop staff upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-assets' AND (storage.foldername(name))[1] = public.current_shop_id()::text);
CREATE POLICY "shop staff update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-assets' AND (storage.foldername(name))[1] = public.current_shop_id()::text);
CREATE POLICY "shop staff delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-assets' AND (storage.foldername(name))[1] = public.current_shop_id()::text);