import http from 'node:http';import {readFile} from 'node:fs/promises';import handler from './api/activity.js';
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/sw.js':'sw.js','/samples.js':'samples.js'};
http.createServer(async(req,res)=>{
 res.status=n=>{res.statusCode=n;return res;};res.json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/activity') {let body='';try{for await(const chunk of req){body+=chunk;if(body.length>4096)return res.status(413).json({error:'Request too large.'});}req.body=JSON.parse(body||'{}');return await handler(req,res);}catch{return res.status(400).json({error:'Invalid JSON.'});}}
 if(!files[path]) {res.writeHead(404);return res.end('Not found');}
 try{res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL(`public/${files[path]}`,import.meta.url)));}catch{res.writeHead(500);res.end('Unable to load page');}
}).listen(3000,'127.0.0.1',()=>console.log('OutsideClass: http://localhost:3000'));
