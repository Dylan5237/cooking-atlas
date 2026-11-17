-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySpace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '家常菜',
    "coverKey" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 2,
    "cookingMinutes" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT '待补充',
    "description" TEXT NOT NULL DEFAULT '',
    "ingredients" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeFavorite" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealRequest" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealDate" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "recipeIds" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "items" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingLog" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "mealPlanId" TEXT,
    "cookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photos" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "CookingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openid_key" ON "User"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySpace_inviteCode_key" ON "FamilySpace"("inviteCode");

-- CreateIndex
CREATE INDEX "FamilyMembership_userId_status_idx" ON "FamilyMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMembership_spaceId_userId_key" ON "FamilyMembership"("spaceId", "userId");

-- CreateIndex
CREATE INDEX "Recipe_spaceId_status_createdAt_idx" ON "Recipe"("spaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Recipe_spaceId_category_idx" ON "Recipe"("spaceId", "category");

-- CreateIndex
CREATE INDEX "RecipeFavorite_spaceId_userId_idx" ON "RecipeFavorite"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeFavorite_spaceId_userId_recipeId_key" ON "RecipeFavorite"("spaceId", "userId", "recipeId");

-- CreateIndex
CREATE INDEX "MealRequest_spaceId_status_mealDate_idx" ON "MealRequest"("spaceId", "status", "mealDate");

-- CreateIndex
CREATE INDEX "MealPlan_spaceId_status_createdAt_idx" ON "MealPlan"("spaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShoppingList_spaceId_createdAt_idx" ON "ShoppingList"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CookingLog_spaceId_cookedAt_idx" ON "CookingLog"("spaceId", "cookedAt");

-- AddForeignKey
ALTER TABLE "FamilySpace" ADD CONSTRAINT "FamilySpace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "FamilySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "FamilySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFavorite" ADD CONSTRAINT "RecipeFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFavorite" ADD CONSTRAINT "RecipeFavorite_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealRequest" ADD CONSTRAINT "MealRequest_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "FamilySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealRequest" ADD CONSTRAINT "MealRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "FamilySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "FamilySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingLog" ADD CONSTRAINT "CookingLog_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "FamilySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingLog" ADD CONSTRAINT "CookingLog_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
