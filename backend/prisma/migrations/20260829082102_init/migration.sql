-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'QUEUED', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ImageFormat" AS ENUM ('JPEG', 'PNG', 'HEIC');

-- CreateEnum
CREATE TYPE "RejectionCode" AS ENUM ('TOO_SMALL_FILE', 'TOO_SMALL_RESOLUTION', 'INVALID_FORMAT', 'TOO_SIMILAR', 'BLURRY', 'FACE_TOO_SMALL', 'MULTIPLE_FACES', 'NO_FACE', 'PROCESSING_ERROR');

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" UUID NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "convertedStorageKey" VARCHAR(512),
    "mimeType" VARCHAR(100) NOT NULL,
    "format" "ImageFormat" NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "ImageStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "contentHash" VARCHAR(128),
    "perceptualHash" VARCHAR(128),
    "blurScore" DOUBLE PRECISION,
    "faceCount" INTEGER,
    "faceAreaRatio" DOUBLE PRECISION,
    "metadata" JSONB,
    "uploadedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageRejection" (
    "id" UUID NOT NULL,
    "imageId" UUID NOT NULL,
    "code" "RejectionCode" NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageRejection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageStatusEvent" (
    "id" BIGSERIAL NOT NULL,
    "imageId" UUID NOT NULL,
    "status" "ImageStatus" NOT NULL,
    "message" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_storageKey_key" ON "ImageAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_contentHash_key" ON "ImageAsset"("contentHash");

-- CreateIndex
CREATE INDEX "ImageAsset_status_createdAt_id_idx" ON "ImageAsset"("status", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ImageAsset_perceptualHash_idx" ON "ImageAsset"("perceptualHash");

-- CreateIndex
CREATE INDEX "ImageAsset_createdAt_id_idx" ON "ImageAsset"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ImageRejection_imageId_createdAt_idx" ON "ImageRejection"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageRejection_code_idx" ON "ImageRejection"("code");

-- CreateIndex
CREATE INDEX "ImageStatusEvent_imageId_createdAt_idx" ON "ImageStatusEvent"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageStatusEvent_status_createdAt_idx" ON "ImageStatusEvent"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ImageRejection" ADD CONSTRAINT "ImageRejection_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageStatusEvent" ADD CONSTRAINT "ImageStatusEvent_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
