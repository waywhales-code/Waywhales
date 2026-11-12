const CACHE='waywhales-static-v79';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('waywhales-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
 const isPage=event.request.mode==='navigate'||new URL(event.request.url).pathname.endsWith('/index.html')||new URL(event.request.url).pathname.endsWith('/Waywhales/');
 if(isPage){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy))}return response}).catch(()=>caches.match('./index.html')));return}
 event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?event.data.json():{}}catch(_){}
 const title=typeof payload.title==='string'&&payload.title.trim()?payload.title:'Время для себя';
 const body=typeof payload.body==='string'&&payload.body.trim()?payload.body:'Пора уделить немного времени себе.';
 const options={
  body,
  icon:payload.icon||'./apple-touch-icon.png',
  badge:payload.badge||'./apple-touch-icon.png',
  tag:payload.tag||'cosmos-reminder',
  renotify:false,
  data:{url:payload.url||'./'}
 };
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const appRoot=new URL('./',self.registration.scope);
 let target=appRoot;
 try{
  const candidate=new URL(event.notification.data&&event.notification.data.url||'./',appRoot);
  if(candidate.origin===self.location.origin&&candidate.pathname.startsWith(appRoot.pathname))target=candidate;
 }catch(_){}
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
  const existing=windows.find(client=>{
   try{const url=new URL(client.url);return url.origin===self.location.origin&&url.pathname.startsWith(appRoot.pathname)}catch(_){return false}
  });
  if(existing){
   if('navigate'in existing)existing.navigate(target.href);
   return existing.focus();
  }
  return self.clients.openWindow(target.href);
 }));
});
