import type{Recipe}from'@cooking-atlas/shared'
// 示例成品照来源（Unsplash 免费许可，仅演示数据使用，界面带「示例照片」标记）：
//   米饭 photo-1536304993881-ff6e9eefa2a6 / 汤面 photo-1569718212165-3a8278d5f624
import sampleRice from '../assets/sample-rice.jpg'
import sampleNoodles from '../assets/sample-noodles.jpg'

const base={spaceId:'family-demo',difficulty:'简单',createdBy:'owner-demo',createdAt:'2026-11-16',updatedAt:'2026-11-16',source:'manual' as const,version:1,coverUrl:''}

export const demoRecipes:Recipe[]=[
 {...base,id:'r1',title:'番茄炒蛋',category:'家常菜',servings:2,cookingMinutes:15,description:'酸甜开胃的家常菜。',ingredients:[{name:'番茄',quantity:2,unit:'个'},{name:'鸡蛋',quantity:3,unit:'个'},{name:'食用油',quantity:null,unit:'适量'}],steps:[{content:'番茄切块，鸡蛋打散。'},{content:'先炒鸡蛋盛出，再炒番茄至出汁，混合调味。'}]},
 {...base,id:'r2',title:'蒜蓉西兰花',category:'素菜',servings:2,cookingMinutes:12,description:'清爽脆嫩。',ingredients:[{name:'西兰花',quantity:1,unit:'颗'},{name:'大蒜',quantity:3,unit:'瓣'}],steps:[{content:'西兰花切朵焯水，蒜末爆香后翻炒调味。'}]},
 {...base,id:'r3',title:'冬瓜排骨汤',category:'汤羹',servings:4,cookingMinutes:60,description:'清润家常汤。',ingredients:[{name:'冬瓜',quantity:500,unit:'g'},{name:'排骨',quantity:500,unit:'g'},{name:'生姜',quantity:3,unit:'片'}],steps:[{content:'排骨焯水，与姜片炖煮，加入冬瓜煮至软熟。'}]},
 // 主食样例：米饭=配餐主食；家常汤面=一餐式主食（本身是这餐主体）
 {...base,id:'r4',title:'米饭',category:'主食',servings:2,cookingMinutes:30,description:'',coverUrl:sampleRice,ingredients:[{name:'大米',quantity:150,unit:'g'}],steps:[{content:'大米淘洗，加等量水，电饭煲煮熟。'}]},
 {...base,id:'r5',title:'家常汤面',category:'主食',servings:2,cookingMinutes:20,description:'',coverUrl:sampleNoodles,ingredients:[{name:'面条',quantity:200,unit:'g'},{name:'青菜',quantity:100,unit:'g'},{name:'生抽',quantity:15,unit:'ml'}],steps:[{content:'水开下面，起锅前烫青菜，调味装碗。'}]},
]

/** 演示数据中使用示例照片的菜谱（界面据此显示「示例照片」标记） */
export const demoSampleCoverIds:string[]=['r4','r5']
