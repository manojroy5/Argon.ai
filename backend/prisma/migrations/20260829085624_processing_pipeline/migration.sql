-- DropIndex
DROP INDEX "ImageAsset_contentHash_key";

-- CreateIndex
CREATE INDEX "ImageAsset_contentHash_idx" ON "ImageAsset"("contentHash");
