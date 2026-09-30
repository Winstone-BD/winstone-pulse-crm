import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadMyPhoto } from "@/lib/staff-photo.functions";

/** Center-crops to a 512px square JPEG in the browser, then uploads. */
async function toSquareJpeg(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("শুধু ছবি দেওয়া যাবে");
  const img = await createImageBitmap(file);
  if (Math.min(img.width, img.height) < 300) throw new Error("ছবিটি খুব ছোট — কমপক্ষে ৩০০×৩০০ পিক্সেলের পরিষ্কার ছবি দিন");
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function PhotoUpload({ label = "ছবি আপলোড করুন" }: { label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadMyPhoto);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (file: File) => upload({ data: { dataUrl: await toSquareJpeg(file) } }),
    onSuccess: () => {
      toast.success("ছবি সংরক্ষণ হয়েছে");
      void qc.invalidateQueries({ queryKey: ["my-account"] });
      void qc.invalidateQueries({ queryKey: ["crm-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) m.mutate(f);
          e.target.value = "";
        }}
      />
      <Button type="button" size="sm" onClick={() => input.current?.click()} disabled={m.isPending}>
        {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} {label}
      </Button>
    </>
  );
}
