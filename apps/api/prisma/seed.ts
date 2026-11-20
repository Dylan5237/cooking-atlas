import {PrismaClient} from '@prisma/client'
const prisma=new PrismaClient()
async function main(){
 const openid='local-demo-owner'
 const user=await prisma.user.upsert({where:{openid},create:{openid,displayName:'料理图鉴管理员'},update:{}})
 const existing=await prisma.familySpace.findFirst({where:{ownerId:user.id,name:'本地演示家庭'}})
 if(!existing)await prisma.familySpace.create({data:{name:'本地演示家庭',ownerId:user.id,inviteCode:'DEMO2026',memberships:{create:{userId:user.id,role:'owner'}}}})
}
main().finally(()=>prisma.$disconnect())
