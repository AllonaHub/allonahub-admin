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
if(total>=300&&total<=720){greeting.textContent="Günaydın";visual.classList.add("sun-visual")}
else if(total>=721&&total<=1140){greeting.textContent="Merhaba";visual.classList.add("day-visual")}
else if(total>=1141&&total<=1380){greeting.textContent="İyi Akşamlar";visual.classList.add("evening-visual")}
else{greeting.textContent="İyi Geceler";visual.classList.add("night-visual")}
	}
if(document.getElementById("heroClock")){
updateHeroTime();
setInterval(updateHeroTime,1000);
}

const heroAdModules=[
{title:"Allona Shop",eyebrow:"Alışveriş",sentence:"Yeni fırsatları, güvenli sepeti ve kampanyaları tek ekranda keşfet.",href:"pages/commerce/allonashop.html",image:"images/ads/hero-ad-shop.jpg",accent:"#00e5ff",cta:"Alışverişe Git"},
{title:"Allona Yemek",eyebrow:"Yemek",sentence:"Yakındaki lezzetleri sıcak servis ve hızlı sipariş akışıyla sofrana taşı.",href:"pages/commerce/allonayemek.html",image:"images/ads/hero-ad-yemek.jpg",accent:"#ff8a3d",cta:"Lezzetleri Gör"},
{title:"Allona Market",eyebrow:"Market",sentence:"Günlük ihtiyaçlarını hızlı teslimat ve kolay sepet deneyimiyle tamamla.",href:"pages/commerce/allonamarket.html",image:"images/ads/hero-ad-market.jpg",accent:"#20e3a2",cta:"Markete Git"},
{title:"Allona Taksi",eyebrow:"Ulaşım",sentence:"Şehir içi yolculuklarını güvenli rota ve canlı sürücü akışıyla başlat.",href:"pages/ecosystem/allonataksi.html",image:"images/ads/hero-ad-taksi.jpg",accent:"#46a6ff",cta:"Taksi Çağır"},
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
const title=document.createElement("h1");
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
if(cityEl){cityEl.textContent=city||"Konum belirlenemedi"}
if(countryEl){countryEl.textContent=country||"İzin verilmedi"}
if(pinEl){
pinEl.classList.toggle("is-location-active",Boolean(active));
const label=active?"Konum izni açık":"Konum izni kapalı";
pinEl["__allonaSource_aria-label"]=label;
pinEl.__allonaSource_title=label;
pinEl.setAttribute("aria-label",label);
pinEl.setAttribute("title",label);
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
const providers=[
`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1&accept-language=tr`,
`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=tr`
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
card.setAttribute("aria-label","Canlı konumu belirle");
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

const approvedAds={
pet:[
{title:"Kayıp Kedi Aranıyor",desc:"Beyaz-gri British, son görüldüğü yer Kadıköy.",meta:"Kayıp • Kadıköy • 2 saat önce"},
{title:"Golden Sahiplendirme",desc:"Aşıları tam, aile ortamına uygun.",meta:"Sahiplendirme • Ataşehir"},
{title:"Bulunan Köpek",desc:"Tasmali erkek köpek bulundu.",meta:"Bulundu • Beşiktaş"}
],
job:[
{title:"Muhasebe Personeli",desc:"Tam zamanlı ofis pozisyonu.",meta:"İş İlanı • İstanbul"},
{title:"E-Ticaret Uzmanı",desc:"Pazaryeri ürün yönetimi bilen ekip arkadaşı.",meta:"Aranıyor • Hibrit"},
{title:"Satış Danışmanı",desc:"Mağaza satış deneyimi olan.",meta:"Aranıyor • Avrupa Yakası"}
],
maritime:[
{title:"2nd Engineer Aranıyor",desc:"Bulk carrier için deneyimli personel.",meta:"Denizcilik • Acil"},
{title:"AB Aranıyor",desc:"24 ay deneyimli güverte personeli.",meta:"Crew • İstanbul"},
{title:"Chief Officer",desc:"Kuru yük gemisi için aday aranıyor.",meta:"Maritime • Başvuru açık"}
],
realestate:[
{title:"2+1 Kiralık Daire",desc:"Site içinde, ulaşımı kolay.",meta:"Kiralık • Beylikdüzü"},
{title:"Satılık Villa",desc:"Bahçeli, güvenlikli lüks yaşam alanı.",meta:"Satılık • Büyükçekmece"},
{title:"Ofis Kiralık",desc:"Merkezi konum, hazır kullanıma uygun.",meta:"Kiralık • Şişli"}
],
service:[
{title:"Acil Tesisatçı Aranıyor",desc:"Su kaçağı için yakındaki ustalar.",meta:"Hizmet Talebi • Acil"},
{title:"Ev Temizliği",desc:"Haftalık temizlik hizmeti aranıyor.",meta:"Aranıyor • Kadıköy"},
{title:"Boyacı Usta",desc:"2+1 daire boya işi için teklif bekleniyor.",meta:"Teklif • İstanbul"}
]
};

let adIndex={};
function rotateAds(){
document.querySelectorAll(".live-ad-card").forEach(card=>{
const type=card.dataset.type;
const ads=approvedAds[type];
adIndex[type]=(adIndex[type]||0)%ads.length;
const ad=ads[adIndex[type]];
card.querySelector(".ad-title").textContent=ad.title;
card.querySelector(".ad-desc").textContent=ad.desc;
card.querySelector(".ad-meta").textContent=ad.meta;
adIndex[type]++;
});
}
rotateAds();
setInterval(rotateAds,6000);

const verifiedStatKeys={
activeUsers:["active_user_count","user_count"],
activeAds:["active_partner_count","partner_count"],
jobAds:["new_user_count","new_member_count"],
crewApps:["crew_count","maritime_crew_count"],
dailyHP:["hp_points_issued","daily_hp_points"]
};
function formatNumber(num){return Number(num).toLocaleString("tr-TR")}
function clearLiveStats(){Object.keys(verifiedStatKeys).forEach(id=>{const node=document.getElementById(id);if(node){node.textContent="—";node.closest(".stat-live-card")?.classList.remove("has-verified-stat")}})}
function updateLiveStats(metrics){
const globalMetrics=(metrics||[]).filter(item=>!item.countryId&&!item.corridorId);
Object.entries(verifiedStatKeys).forEach(([id,keys])=>{
const metric=globalMetrics.find(item=>keys.includes(item.metricKey));
const node=document.getElementById(id);
if(node&&metric&&Number.isFinite(Number(metric.value))){node.textContent=formatNumber(metric.value);node.closest(".stat-live-card")?.classList.add("has-verified-stat")}
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
if(!payload.published||!Array.isArray(payload.metrics)||!payload.metrics.length){return}
updateLiveStats(payload.metrics);
if(source){source.textContent="Sayaçlar doğrulanmış ve public olarak yayımlanmış aggregate kayıtlardan gelir."}
}catch(error){
if(source){source.textContent="Doğrulanmış aggregate veri yayınlanmadığı için sayaç gösterilmiyor."}
}
}
loadVerifiedStats();

const searchRoutes=[
{keys:["türk dünyası","turkic world","ticaret koridoru","azerbaycan","kazakistan","özbekistan","kırgızistan"],url:"/pages/ecosystem/turkic-world.html"},
{keys:["shop","alışveriş","pazaryeri","ürün"],url:"/pages/commerce/allonashop.html"},
{keys:["yemek","restoran","burger","pizza"],url:"/pages/commerce/allonayemek.html"},
{keys:["market","süpermarket","gıda"],url:"/pages/commerce/allonamarket.html"},
{keys:["taksi","ulaşım"],url:"/pages/ecosystem/allonataksi.html"},
{keys:["denizcilik","gemi","crew","maritime"],url:"/pages/ecosystem/allonadenizcilik.html"},
{keys:["avm","alışveriş merkezi","mall"],url:"/pages/ecosystem/yakında.html?module=avm-dunyasi"},
{keys:["sağlık","doktor","eczane"],url:"/pages/ecosystem/yakında.html?module=saglik"},
{keys:["seyahat","turizm","bilet"],url:"/pages/ecosystem/yakında.html?module=seyahat"},
{keys:["gayrimenkul","ev","arsa","kiralık","satılık"],url:"/pages/ecosystem/yakında.html?module=gayrimenkul"},
{keys:["hukuk","avukat"],url:"/pages/ecosystem/yakında.html?module=hukuk"},
{keys:["danışmanlık","vize","ikamet"],url:"/pages/ecosystem/yakında.html?module=danismanlik"},
{keys:["eğitim","kurs"],url:"/pages/ecosystem/yakında.html?module=egitim"},
{keys:["kariyer","iş","cv"],url:"/pages/ecosystem/yakında.html?module=kariyer"},
{keys:["finans","kredi"],url:"/pages/ecosystem/yakında.html?module=finans"},
{keys:["otomotiv","araç","araba"],url:"/pages/ecosystem/yakında.html?module=otomotiv"},
{keys:["eğlence","etkinlik","konser","maç"],url:"/pages/ecosystem/yakında.html?module=eglence"},
{keys:["evcil","pet","veteriner"],url:"/pages/ecosystem/yakında.html?module=evcilhayvan"},
{keys:["teknoloji","telefon","bilgisayar"],url:"/pages/ecosystem/yakında.html?module=teknoloji"},
{keys:["spor","fitness"],url:"/pages/ecosystem/yakında.html?module=sporfitnes"},
{keys:["güzellik","kozmetik"],url:"/pages/ecosystem/yakında.html?module=guzellik"},
{keys:["sigorta","kasko","dask"],url:"/pages/ecosystem/yakında.html?module=sigorta"},
{keys:["kurye","teslimat"],url:"/pages/ecosystem/yakında.html?module=kurye"},
{keys:["ev hizmetleri","temizlik","usta"],url:"/pages/ecosystem/yakında.html?module=evhizmetleri"},
{keys:["kargo","lojistik"],url:"/pages/ecosystem/yakında.html?module=lojistik"},
{keys:["nakliye","taşıma"],url:"/pages/ecosystem/yakında.html?module=nakliye"},
{keys:["organizasyon","düğün","nişan"],url:"/pages/ecosystem/yakında.html?module=organizasyon"},
{keys:["tarım","çiftçi","gübre","tohum"],url:"/pages/ecosystem/yakında.html?module=tarim"},
{keys:["inşaat","yapı","müteahhit"],url:"/pages/ecosystem/yakında.html?module=insaat"},
{keys:["mühendislik","mühendis"],url:"/pages/ecosystem/yakında.html?module=muhendislik"},
{keys:["trade","ithalat","ihracat"],url:"/pages/ecosystem/yakında.html?module=trade"},
{keys:["otelcilik","otel","konaklama"],url:"/pages/ecosystem/yakında.html?module=otelcilik"},
{keys:["kupon","hp","kampanya","indirim"],url:"/pages/commerce/kuponlar.html"},
{keys:["wallet","pay"],url:"/pages/account/rewards.html"}
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
else{window.location.href=appUrl(`/pages/search/arama.html?q=${encodeURIComponent(q)}`)}
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
