/*
  Warnings:

  - The `expiresIn` column on the `Story` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Story" DROP COLUMN "expiresIn",
ADD COLUMN     "expiresIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
