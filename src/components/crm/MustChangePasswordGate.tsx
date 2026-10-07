import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Agents flagged by IT must set their own password before using any page. */
export function MustChangePasswordGate() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (pathname === "/reset-password" || pathname === "/auth") return;
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive && data.user?.app_metadata?.["must_change_password"] === true) {
        void navigate({ to: "/reset-password" });
      }
    });
    return () => {
      alive = false;
    };
  }, [pathname, navigate]);
  return null;
}
