import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAdminToken } from "@/lib/local-session";
import { staffPhotoUrls } from "@/lib/staff-photo.functions";

/** Photo for one staff member; falls back to coloured initials. */
export function StaffAvatar({
  profile,
  className = "size-11",
}: {
  profile: { id: string; name: string; avatar_hue: number; photo_updated_at?: string | null };
  className?: string;
}) {
  const adminToken = useAdminToken();
  const fetchUrls = useServerFn(staffPhotoUrls);
  const { data } = useQuery({
    queryKey: ["staff-photo", profile.id, profile.photo_updated_at ?? null],
    queryFn: () => fetchUrls({ data: { adminToken, profileIds: [profile.id] } }),
    enabled: Boolean(profile.photo_updated_at),
    staleTime: 50 * 60_000,
  });
  const url = data?.[profile.id];
  if (url) return <img src={url} alt={profile.name} className={`${className} shrink-0 rounded-full object-cover`} />;
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground`}
      style={{ backgroundColor: `hsl(${profile.avatar_hue} 65% 45%)` }}
    >
      {profile.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
