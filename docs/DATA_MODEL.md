# PostgreSQL 数据模型

Prisma Schema：apps/api/prisma/schema.prisma。

| 模型 | 用途 |
|---|---|
| User | 微信用户，openid 唯一 |
| FamilySpace | 家庭空间，ownerId、邀请码 |
| FamilyMembership | 用户与家庭空间关系、owner/member 角色 |
| Recipe | 菜谱、食材 JSON、步骤 JSON、版本、封面对象 key |
| RecipeFavorite | 成员收藏，spaceId + userId + recipeId 唯一 |
| MealRequest | 家庭成员一次点菜提交 |
| MealPlan | owner 确认的家庭菜单，items 保存菜谱快照 |
| ShoppingList | 由已确认菜单生成的采购清单 |
| CookingLog | 实际烹饪记录、照片和心得 |

## 关键约束
- 所有家庭业务表带 spaceId，服务端每次操作校验 active membership。
- 客户端传入的 userId/openid/role 不可信；身份只能来自已验证 JWT。
- 菜谱创建、编辑、删除、菜单确认、采购清单生成和修改仅 owner。
- MealPlan.items 保存 recipeId、recipeVersion、原始 servings、snapshotIngredients，避免菜谱更新污染历史清单。
- ShoppingList.items 保存来源菜谱 ID、数量、单位和状态。
- 同名食材仅在单位一致时自动合并；未知数量不推算精确值。
- inviteCode 应使用高熵随机值；正式上线前建议保存 hash、增加过期/撤销机制和加入频率限制。

## 对象存储
对象 key 采用 spaces/{spaceId}/{timestamp}-{uuid}-{filename}。bucket 私有，客户端不得持有 S3 凭证。访问图片由 API 返回短期签名 URL。
