# 数据模型

集合建议：users、family_spaces、family_memberships、recipes、recipe_favorites、meal_requests、meal_plans、shopping_lists、cooking_logs。

- family_spaces: name, ownerOpenid, inviteCodeHash, status, createdAt
- family_memberships: spaceId, openid, displayName, role(owner/member), status, joinedAt
- recipes: spaceId, title, category, coverFileId, servings, cookingMinutes, difficulty, description, ingredients[{name,quantity,unit,note}], steps[{content,imageFileId}], createdBy, version, status, createdAt, updatedAt
- recipe_favorites: spaceId, openid, recipeId, createdAt；建议唯一索引(spaceId,openid,recipeId)
- meal_requests: spaceId, openid, mealDate, mealType, servings, recipeIds, note, status, createdAt
- meal_plans: spaceId, title, mealType, servings, status, items[{recipeId,recipeTitle,servings,source,snapshotIngredients,recipeVersion}], createdBy, confirmedBy, createdAt, confirmedAt
- shopping_lists: spaceId, mealPlanId, title, status, items[{name,quantity,unit,displayQuantity,status,sourceRecipeIds,note}], createdAt, updatedAt
- cooking_logs: spaceId, recipeId, mealPlanId, cookedAt, photos, notes, rating, createdBy

安全要求：客户端提交的 openid/role/owner 身份不可信；云函数从 getWXContext 获取 OPENID；每个操作校验 active membership；菜谱写操作、菜单确认和采购清单写操作必须 owner；文件路径按空间隔离。
