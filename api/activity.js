import {validateInput,parseActivity,promptFor} from '../lib/activity.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
 let input;try {input=validateInput(req.body);}catch(e){return res.status(400).json({error:e.message});}
 if(!process.env.GEMMA_API_KEY) return res.status(503).json({error:'Live AI is not connected yet. Try a sample activity below.'});
 const model=process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
 if(!/^gemma-[a-z0-9-]+$/.test(model)) return res.status(503).json({error:'The AI model configuration needs attention.'});
 try {
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMMA_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:promptFor(input)}]}],generationConfig:{temperature:0.6,maxOutputTokens:2400}}),signal:AbortSignal.timeout(25000)});
  if(!response.ok) return res.status(response.status===429?429:502).json({error:response.status===429?'The AI usage limit was reached. Try a sample or come back later.':'The AI provider could not make an activity. Try a sample or retry later.'});
  const result=await response.json();const raw=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  const activity=parseActivity(raw);return res.status(200).json({activity:{...activity,...input,source:`Gemma · ${model}`}});
 }catch {return res.status(502).json({error:'The AI response was interrupted or incomplete. Please retry or use a sample.'});}
}
