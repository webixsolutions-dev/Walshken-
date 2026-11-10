-- Deny Data API access and preserve administrative history.
DO $guard$
DECLARE
  table_name text;
  client_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['organizations','units','employees','sessions','audit','markets','services','availability',
    'site_content','inquiries','rate_limits','projects','tasks','task_comments','shifts','attendance','breaks','timesheets','corrections',
    'leave_requests','conversations','conversation_members','messages','message_reactions','meetings','meeting_members','documents',
    'document_grants','compensation','payroll','holidays','notifications','integrations','file_objects','credentials','invitations']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated','service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END $guard$;
--> statement-breakpoint
CREATE FUNCTION public.walshken_reject_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Walshken history rows are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER walshken_audit_immutable BEFORE UPDATE OR DELETE ON public.audit
FOR EACH ROW EXECUTE FUNCTION public.walshken_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER walshken_payroll_immutable BEFORE UPDATE OR DELETE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION public.walshken_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER walshken_compensation_immutable BEFORE UPDATE OR DELETE ON public.compensation
FOR EACH ROW EXECUTE FUNCTION public.walshken_reject_history_mutation();
