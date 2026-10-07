// Per-instance burst protection. This is not a distributed quota or billing cap.
const clients=new Map();
export function allowRequest(req,now=Date.now()){
 if(!process.env.VERCEL)return true;
 const address=req.headers?.['x-real-ip']||req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()||'unknown';
 const key=String(address).slice(0,100),previous=clients.get(key);
 if(!previous||now-previous.start>=60000){if(clients.size>=2000)for(const [id,value]of clients)if(now-value.start>=60000)clients.delete(id);if(clients.size>=2000&&!clients.has(key))return false;clients.set(key,{start:now,count:1});return true;}
 previous.count++;return previous.count<=6;
}
