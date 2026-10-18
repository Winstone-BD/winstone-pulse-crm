-- Signed-in CRM staff may view/download project photos from the private bucket.
-- The decision recorded during the security pass was that any signed-in staff
-- member can read project photos (finding marked as intended). The bucket stays
-- private: signed-out callers have no policy and remain refused.
cREATE POLICY "Authenticated staff can view project photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'project-photos');