function homeText(source){
const platform=window.Allona&&window.Allona.platform;
return platform&&typeof platform.localize==="function"?platform.localize(source):source
}

function setHomeText(node,source){
if(!node){return}
node.dataset.homeSource=source;
node.textContent=homeText(source);
}

const homeLocales={tr:"tr-TR",az:"az-AZ",kk:"kk-KZ",uz:"uz-UZ",ky:"ky-KG",en:"en-US",de:"de-DE",ru:"ru-RU",ar:"ar-AE"};
function homeLanguage(){return document.documentElement.lang||"tr"}

function updateHeroTime(){
const now=new Date();
const h=now.getHours();
const m=now.getMinutes();
const s=now.getSeconds();
const clock=document.getElementById("heroClock");
const greeting=document.getElementById("heroGreeting");
const visual=document.getElementById("timeVisual");
if(!clock||!greeting||!visual){return}
const pad=n=>String(n).padStart(2,"0");
clock.textContent=`${pad(h)}:${pad(m)}:${pad(s)}`;
const total=h*60+m;
visual.className="time-visual";
if(total>=300&&total<=720){setHomeText(greeting,"Günaydın");visual.classList.add("sun-visual")}
else if(total>=721&&total<=1140){setHomeText(greeting,"Merhaba");visual.classList.add("day-visual")}
else if(total>=1141&&total<=1380){setHomeText(greeting,"İyi Akşamlar");visual.classList.add("evening-visual")}
else{setHomeText(greeting,"İyi Geceler");visual.classList.add("night-visual")}
	}
if(document.getElementById("heroClock")){
updateHeroTime();
setInterval(updateHeroTime,1000);
}

const heroAdModules=[
{title:"Allona Shop",eyebrow:"Alışveriş",sentence:"Yeni ürünleri ve alışveriş seçeneklerini tek ekranda keşfet.",href:"pages/commerce/allonashop.html",image:"images/ads/hero-ad-shop.jpg",accent:"#00e5ff",cta:"Alışverişe Git"},
{title:"Denizcilik",eyebrow:"Maritime",sentence:"Gemi, crew ve denizcilik fırsatlarını profesyonel ağ içinde buluştur.",href:"pages/ecosystem/allonadenizcilik.html",image:"images/ads/hero-ad-denizcilik.jpg",accent:"#00b4d8",cta:"Denize Açıl"}
];

function createHeroAdSlide(ad,index){
const slide=document.createElement("a");
slide.className="ad-hero__slide";
slide.dataset.adSlide="";
slide.href=ad.href;
slide.style.setProperty("--ad-accent",ad.accent);
slide.setAttribute("aria-label",`${ad.title} modülüne git`);
slide.setAttribute("aria-hidden",index===0?"false":"true");
slide.tabIndex=index===0?0:-1;
if(index===0){slide.classList.add("is-active")}
const content=document.createElement("div");
content.className="ad-hero__content";
const eyebrow=document.createElement("span");
eyebrow.className="ad-hero__eyebrow";
eyebrow.textContent=ad.eyebrow;
const title=document.createElement("h2");
title.textContent=ad.title;
const sentence=document.createElement("p");
sentence.textContent=ad.sentence;
const actions=document.createElement("div");
actions.className="ad-hero__actions";
const cta=document.createElement("span");
cta.className="ad-hero__button";
cta.textContent=ad.cta||"Modüle Git";
actions.append(cta);
content.append(eyebrow,title,sentence,actions);
const media=document.createElement("span");
media.className="ad-hero__media";
media.setAttribute("aria-hidden","true");
const image=document.createElement("img");
image.src=ad.image;
image.alt=`${ad.title} reklam vitrini`;
image.loading=index<3?"eager":"lazy";
image.decoding="async";
media.append(image);
slide.append(content,media);
return slide
}

function createHeroAdDot(ad,index){
const dot=document.createElement("button");
dot.className="ad-hero__dot";
dot.type="button";
dot.dataset.adDot="";
dot.setAttribute("aria-label",`${ad.title} reklamı`);
dot.setAttribute("aria-pressed",index===0?"true":"false");
dot.style.setProperty("--dot-color",ad.accent);
if(index===0){dot.classList.add("is-active")}
return dot
}

function initHeroAdSlider(){
const hero=document.querySelector("[data-ad-hero]");
if(!hero){return}
const slideStage=hero.querySelector("[data-ad-slides]");
const dotStage=hero.querySelector("[data-ad-dots]");
if(slideStage&&heroAdModules.length){
slideStage.replaceChildren(...heroAdModules.map(createHeroAdSlide));
}
if(dotStage&&heroAdModules.length){
dotStage.replaceChildren(...heroAdModules.map(createHeroAdDot));
}
const slides=[...hero.querySelectorAll("[data-ad-slide]")];
const dots=[...hero.querySelectorAll("[data-ad-dot]")];
if(slides.length<2){return}
let index=0;
let timer;
function showSlide(nextIndex){
index=(nextIndex+slides.length)%slides.length;
slides.forEach((slide,slideIndex)=>{
const active=slideIndex===index;
slide.classList.toggle("is-active",active);
slide.setAttribute("aria-hidden",active?"false":"true");
slide.tabIndex=active?0:-1;
});
dots.forEach((dot,dotIndex)=>{
const active=dotIndex===index;
dot.classList.toggle("is-active",active);
dot.setAttribute("aria-pressed",active?"true":"false");
const accent=slides[index]?.style.getPropertyValue("--ad-accent")||"#00e5ff";
dot.style.setProperty("--dot-color",accent);
});
if(dots[index]){
const stage=dots[index].parentElement;
if(stage){
const dotRect=dots[index].getBoundingClientRect();
const stageRect=stage.getBoundingClientRect();
const offset=dotRect.left-stageRect.left-(stageRect.width-dotRect.width)/2;
stage.scrollTo({left:stage.scrollLeft+offset,behavior:"smooth"});
}
}
}
function start(){
clearInterval(timer);
timer=setInterval(()=>showSlide(index+1),2000);
}
dots.forEach((dot,dotIndex)=>{
dot.addEventListener("click",()=>{
showSlide(dotIndex);
start();
});
});
hero.addEventListener("mouseenter",()=>clearInterval(timer));
hero.addEventListener("mouseleave",start);
hero.addEventListener("focusin",()=>clearInterval(timer));
hero.addEventListener("focusout",start);
showSlide(0);
start();
}
initHeroAdSlider();

function initMobileModuleRailOrder(){
const grid=document.querySelector(".modules-section .modules-grid.large-grid");
if(!grid){return}
const orderMap=[1,3,2,4];
[...grid.querySelectorAll(".module-card")].forEach((card,index)=>{
const page=Math.floor(index/4);
const slot=orderMap[index%4];
card.style.setProperty("--mobile-module-order",String(page*4+slot));
});
}
initMobileModuleRailOrder();

function updateLocationStatus(active,city,country){
const cityEl=document.getElementById("heroCity");
const countryEl=document.getElementById("heroCountry");
const pinEl=document.getElementById("heroLocationStatus")||document.querySelector(".pin-dot");
if(cityEl){setHomeText(cityEl,city||"Konum belirlenemedi")}
if(countryEl){setHomeText(countryEl,country||"İzin verilmedi")}
if(pinEl){
pinEl.classList.toggle("is-location-active",Boolean(active));
const label=active?"Konum izni açık":"Konum izni kapalı";
pinEl["__allonaSource_aria-label"]=label;
pinEl.__allonaSource_title=label;
pinEl.setAttribute("aria-label",homeText(label));
pinEl.setAttribute("title",homeText(label));
	}
}

const locationFallbacks={
"Europe/Istanbul":{city:"İstanbul",country:"Türkiye"},
"Asia/Baku":{city:"Bakü",country:"Azerbaycan"},
"Asia/Dubai":{city:"Dubai",country:"Birleşik Arap Emirlikleri"},
"Asia/Riyadh":{city:"Riyad",country:"Suudi Arabistan"},
"Europe/Berlin":{city:"Berlin",country:"Almanya"},
"Europe/London":{city:"Londra",country:"Birleşik Krallık"},
"Europe/Paris":{city:"Paris",country:"Fransa"},
"America/New_York":{city:"New York",country:"Amerika Birleşik Devletleri"},
"America/Chicago":{city:"Chicago",country:"Amerika Birleşik Devletleri"},
"America/Denver":{city:"Denver",country:"Amerika Birleşik Devletleri"},
"America/Los_Angeles":{city:"Los Angeles",country:"Amerika Birleşik Devletleri"},
"America/Toronto":{city:"Toronto",country:"Kanada"}
};

const localeCountryFallbacks={
TR:{city:"Türkiye",country:"Yaklaşık konum"},
AZ:{city:"Azerbaycan",country:"Yaklaşık konum"},
US:{city:"Amerika Birleşik Devletleri",country:"Yaklaşık konum"},
GB:{city:"Birleşik Krallık",country:"Yaklaşık konum"},
DE:{city:"Almanya",country:"Yaklaşık konum"},
FR:{city:"Fransa",country:"Yaklaşık konum"},
AE:{city:"Birleşik Arap Emirlikleri",country:"Yaklaşık konum"},
SA:{city:"Suudi Arabistan",country:"Yaklaşık konum"},
RU:{city:"Rusya",country:"Yaklaşık konum"}
};

function regionFromLocale(value){
try{return new Intl.Locale(value).region||""}
catch(e){
const parts=String(value||"").split("-");
return parts.length>1?parts.pop().toUpperCase():""
}
}

function approximateLocation(){
try{
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
if(locationFallbacks[zone]){return {...locationFallbacks[zone],source:"timezone"}}
}catch(e){}
const country=(navigator.languages||[navigator.language||""]).map(regionFromLocale).find(Boolean);
return localeCountryFallbacks[country] ? {...localeCountryFallbacks[country],source:"locale"} : null
}

function showApproximateLocation(){
const fallback=approximateLocation();
if(fallback){
updateLocationStatus(false,fallback.city,"Canlı konum için dokun");
return true
}
updateLocationStatus(false,"Konum belirlenemedi","Canlı konum için dokun");
return false
}

function getLocationErrorMessage(error){
if(error&&error.code===1){return ["Konum izni kapalı","İzin verilmedi"]}
if(error&&error.code===2){return ["Konum alınamadı","Sinyal yok"]}
if(error&&error.code===3){return ["Konum zaman aşımı","Tekrar deneyin"]}
return ["Konum belirlenemedi","İzin verilmedi"]
}

async function reverseGeocodeLocation(lat,lon){
const language=homeLanguage();
const providers=[
`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1&accept-language=${encodeURIComponent(language)}`,
`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=${encodeURIComponent(language)}`
];
for(const url of providers){
try{
const res=await fetch(url,{headers:{Accept:"application/json"}});
if(!res.ok){continue}
const data=await res.json();
const address=data.address||data.localityInfo?.administrative?.reduce((acc,item)=>{
if(item&&item.name&&!acc[item.description]){acc[item.description]=item.name}
return acc
},{})||{};
const city=address.city||address.town||address.village||address.district||address.county||address.state||data.city||data.locality||data.principalSubdivision;
const country=address.country||data.countryName;
if(city||country){return {city,country}}
}catch(e){
}
}
return null
}

async function requestBrowserLocation(options){
const privacy=window.Allona&&window.Allona.privacy;
updateLocationStatus(false,"Konum alınıyor","Tarayıcı izni kontrol ediliyor");
const location=privacy&&privacy.getLocation ? await privacy.getLocation({
maximumAge:600000,
timeout:8000,
prompt:Boolean(options&&options.prompt)
}) : null;
if(!location){
showApproximateLocation();
return
}
const lat=location.latitude;
const lon=location.longitude;
let city="Konum bulundu";
let country="Canlı konum açık";
const place=await reverseGeocodeLocation(lat,lon);
if(place){
city=place.city||city;
country=place.country||country;
}
updateLocationStatus(true,city,country);
}

async function setLocationByBrowser(){
updateLocationStatus(false,"Konum belirlenemedi","İzin durumu kontrol ediliyor");
showApproximateLocation();
if(!navigator.geolocation){return}
let permission;
if(navigator.permissions&&navigator.permissions.query){
try{
permission=await navigator.permissions.query({name:"geolocation"});
}catch(e){
permission=null;
}
if(permission&&"onchange" in permission){
permission.onchange=function(){setLocationByBrowser()};
}
}
if(permission&&permission.state==="denied"){
showApproximateLocation();
return
}
const privacy=window.Allona&&window.Allona.privacy;
if(permission&&permission.state==="prompt"&&privacy&&privacy.cachedLocation&&!privacy.cachedLocation(600000)){
showApproximateLocation();
return
}
requestBrowserLocation();
}
function bindLocationPrompt(){
const card=document.querySelector(".ad-hero__location");
if(!card){return}
card.setAttribute("role","button");
card.setAttribute("tabindex","0");
card["__allonaSource_aria-label"]="Canlı konumu belirle";
card.setAttribute("aria-label",homeText("Canlı konumu belirle"));
card.addEventListener("click",()=>requestBrowserLocation({prompt:true}));
card.addEventListener("keydown",(event)=>{
if(event.key==="Enter"||event.key===" "){
event.preventDefault();
requestBrowserLocation({prompt:true});
}
});
}
bindLocationPrompt();
setLocationByBrowser();

const verifiedStatKeys={
activeUsers:["active_user_count","user_count"],
activeAds:["active_partner_count","partner_count"],
jobAds:["new_user_count","new_member_count"],
activeListings:["active_listing_count","active_job_count"]
};
const statLabels={
activeUsers:"Aktif Kullanıcı",
activeAds:"Aktif Partner",
jobAds:"Yeni Üyeler",
activeListings:"İlanlar"
};
const requiredVerifiedStats=["activeUsers","activeAds","jobAds","activeListings"];
function formatNumber(num){return Number(num).toLocaleString(homeLocales[homeLanguage()]||"tr-TR")}
function metricKeyOf(item){return item?.metricKey||item?.metric_key}
function globalMetricOnly(item){return !(item?.countryId||item?.country_id)&&!(item?.corridorId||item?.corridor_id)}
function finiteMetricValue(value){if(value===null||value===undefined||value===""){return null}const numeric=Number(value);return Number.isFinite(numeric)?numeric:null}
function setLiveStatState(id,text,state){
const node=document.getElementById(id);
if(!node){return}
const card=node.closest(".stat-live-card");
const labelSource=statLabels[id]||id;
const label=homeText(labelSource);
const verified=state==="verified";
const missing=state==="missing";
const displayText=typeof text==="number"?formatNumber(text):homeText(text);
const ariaText=missing?`${label}: ${displayText}. ${homeText("API metriği yayınlandığında sayı otomatik gösterilir.")}`:`${label}: ${displayText==="—"?homeText("veri bekleniyor"):displayText}`;
node.textContent=displayText;
node.dataset.statValue=String(text);
node.dataset.statState=state;
node.classList.toggle("stat-live-status",missing);
node["__allonaSource_aria-label"]=ariaText;
node.setAttribute("aria-label",ariaText);
if(missing){node["__allonaSource_title"]=text;node.setAttribute("title",displayText)}else{node.removeAttribute("title");delete node["__allonaSource_title"]}
card?.classList.toggle("has-verified-stat",verified);
card?.classList.toggle("has-missing-source",missing);
if(card){card["__allonaSource_aria-label"]=ariaText}
card?.setAttribute("aria-label",ariaText);
}
function clearLiveStats(){Object.keys(verifiedStatKeys).forEach(id=>setLiveStatState(id,"—","pending"))}
function updateLiveStats(metrics){
const globalMetrics=(metrics||[]).filter(globalMetricOnly);
Object.entries(verifiedStatKeys).forEach(([id,keys])=>{
const metric=globalMetrics.find(item=>keys.includes(metricKeyOf(item)));
const numericValue=metric?finiteMetricValue(metric.value):null;
if(numericValue!==null){setLiveStatState(id,numericValue,"verified")}
});
}
async function loadVerifiedStats(){
clearLiveStats();
const source=document.getElementById("liveStatsSource");
try{
const base=String(window.Allona?.config?.apiBaseUrl||"").replace(/\/$/,"");
const response=await fetch(`${base}/v1/platform/impact`,{headers:{Accept:"application/json"}});
if(!response.ok){throw new Error(`impact ${response.status}`)}
const payload=await response.json();
if(!Array.isArray(payload.metrics)||!payload.metrics.length){
if(source){setHomeText(source,"Doğrulanmış aggregate veri henüz yayınlanmadı.")}
return
}
updateLiveStats(payload.metrics);
const hasRequiredStats=requiredVerifiedStats.every(id=>{
const node=document.getElementById(id);
return node&&node.textContent.trim()!=="—";
});
if(source){
setHomeText(source,hasRequiredStats
?"Sayaçlar production aggregate veriden gelir; yeni üyeler son 7 günü gösterir."
:"Zorunlu aggregate kaynakları henüz tamamlanmadı.");
}
}catch(error){
if(source){setHomeText(source,"Canlı sayaç kaynağına şu anda ulaşılamıyor.")}
}
}
loadVerifiedStats();

document.addEventListener("allona:language-changed",()=>{
document.querySelectorAll("[data-home-source]").forEach(node=>setHomeText(node,node.dataset.homeSource));
const locationCard=document.querySelector(".ad-hero__location");
if(locationCard){locationCard.setAttribute("aria-label",homeText("Canlı konumu belirle"))}
Object.keys(verifiedStatKeys).forEach(id=>{
const node=document.getElementById(id);
if(!node||!node.dataset.statState){return}
const value=node.dataset.statState==="verified"?Number(node.dataset.statValue):node.dataset.statValue;
setLiveStatState(id,value,node.dataset.statState);
});
updateHeroTime();
setLocationByBrowser();
});

const searchRoutes=[
{keys:["shop","alışveriş","pazaryeri","ürün","shopping","marketplace","product","einkauf","produkt","покупки","товар","alış","mahsulot","дүкен","өнім","متجر","تسوق","منتج"],url:"/pages/commerce/allonashop.html"},
{keys:["denizcilik","gemi","crew","maritime","shipping","ship","seefahrt","schiff","морской","корабль","dənizçilik","gəmi","кеме","теңіз","dengiz","кемечилик","سفينة","بحري"],url:"/pages/ecosystem/allonadenizcilik.html"}
];

function appUrl(path){
return window.Allona&&window.Allona.core?window.Allona.core.url(path):path;
}

function cleanSearchText(value){
return String(value||"").replace(/\s+/g," ").trim().slice(0,120);
}

function globalSearch(){
const input=document.getElementById("globalSearchInput");
const q=cleanSearchText(input&&input.value).toLocaleLowerCase("tr-TR");
if(!q){return}
const found=searchRoutes.find(item=>item.keys.some(k=>q.includes(k)));
if(found){window.location.href=appUrl(found.url)}
else{window.location.href=appUrl("/index.html#modules")}
}

window.globalSearch=globalSearch;

const globalSearchInput=document.getElementById("globalSearchInput");
const globalSearchButton=document.querySelector("[data-global-search]");
if(globalSearchInput){
globalSearchInput.addEventListener("keydown",function(e){
if(e.key==="Enter"){globalSearch()}
});
}
if(globalSearchButton){globalSearchButton.addEventListener("click",globalSearch);}

const homeFooterBlockedRoutes=[
"/pages/commerce/allonayemek.html",
"/pages/commerce/allonamarket.html",
"/pages/commerce/kuponlar.html",
"/pages/premium.html",
"/pages/career/allonakariyer.html"
];

function enhanceHomeFooter(){
const footer=document.querySelector(".site-footer");
if(!footer){return false}
footer.querySelectorAll("a[href]").forEach(link=>{
const href=new URL(link.href,window.location.href).pathname;
if(homeFooterBlockedRoutes.includes(href)){link.remove()}
});
const storeButtons=document.querySelector(".site-footer .store-buttons");
if(storeButtons){storeButtons.remove()}
const paymentStrip=document.querySelector(".site-footer .footer-payment-strip");
if(paymentStrip){paymentStrip.remove()}
return true;
}

function watchHomeFooter(){
if(enhanceHomeFooter()){return}
const observer=new MutationObserver(function(){
if(enhanceHomeFooter()){observer.disconnect()}
});
observer.observe(document.body,{childList:true,subtree:true});
window.setTimeout(function(){observer.disconnect()},10000);
}

if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",watchHomeFooter,{once:true});
}else{
watchHomeFooter();
}
