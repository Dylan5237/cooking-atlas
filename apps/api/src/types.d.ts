import '@fastify/jwt'
declare module '@fastify/jwt' { interface FastifyJWT { payload:{id:string;openid:string}; user:{id:string;openid:string} } }
