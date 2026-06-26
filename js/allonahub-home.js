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

function initHeroAdSlider(){
const hero=document.querySelector("[data-ad-hero]");
if(!hero){return}
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
});
dots.forEach((dot,dotIndex)=>{
const active=dotIndex===index;
dot.classList.toggle("is-active",active);
dot.setAttribute("aria-pressed",active?"true":"false");
const accent=slides[index]?.style.getPropertyValue("--ad-accent")||"#00e5ff";
dot.style.setProperty("--dot-color",accent);
});
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

function requestBrowserLocation(){
navigator.geolocation.getCurrentPosition(async function(pos){
const lat=pos.coords.latitude;
const lon=pos.coords.longitude;
let city="Konum bulundu";
let country="Canlı konum açık";
const place=await reverseGeocodeLocation(lat,lon);
if(place){
city=place.city||city;
country=place.country||country;
}
updateLocationStatus(true,city,country);
},function(error){
const message=getLocationErrorMessage(error);
updateLocationStatus(false,message[0],message[1]);
},{
enableHighAccuracy:false,
maximumAge:600000,
timeout:8000
});
}

async function setLocationByBrowser(){
updateLocationStatus(false,"Konum belirlenemedi","İzin bekleniyor");
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
updateLocationStatus(false,"Konum belirlenemedi","İzin verilmedi");
return
}
requestBrowserLocation();
}
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

const verifiedStats={activeUsers:0,activeAds:0,jobAds:0,crewApps:0,dailyHP:0};
function formatNumber(num){return Number(num).toLocaleString("tr-TR")}
function updateLiveStats(data){
document.getElementById("activeUsers").textContent=formatNumber(data.activeUsers);
document.getElementById("activeAds").textContent=formatNumber(data.activeAds);
document.getElementById("jobAds").textContent=formatNumber(data.jobAds);
document.getElementById("crewApps").textContent=formatNumber(data.crewApps);
document.getElementById("dailyHP").textContent=formatNumber(data.dailyHP);
}
async function loadVerifiedStats(){
const stats={...verifiedStats};
try{
if(window.Allona?.db?.products?.listActive){
const products=await window.Allona.db.products.listActive({sort:"newest"});
stats.activeAds=Array.isArray(products)?products.length:0;
}
}catch(error){
console.warn("AllonaHub canlı istatistikleri alınamadı:",error.message||error);
}
updateLiveStats(stats);
}
loadVerifiedStats();

const searchRoutes=[
{keys:["shop","alışveriş","pazaryeri","ürün"],url:"/pages/commerce/allonashop.html"},
{keys:["yemek","restoran","burger","pizza"],url:"/pages/commerce/allonayemek.html"},
{keys:["market","süpermarket","gıda"],url:"/pages/commerce/allonamarket.html"},
{keys:["taksi","ulaşım"],url:"/pages/ecosystem/allonataksi.html"},
{keys:["avm","alışveriş merkezi","mall"],url:"/pages/ecosystem/allonaavm.html"},
{keys:["sağlık","doktor","eczane"],url:"/pages/ecosystem/allonasaglik.html"},
{keys:["seyahat","turizm","bilet"],url:"/pages/ecosystem/allonaseyahat.html"},
{keys:["gayrimenkul","ev","arsa","kiralık","satılık"],url:"/pages/ecosystem/allonagayrimenkul.html"},
{keys:["denizcilik","gemi","crew","maritime"],url:"/pages/ecosystem/allonadenizcilik.html"},
{keys:["hukuk","avukat"],url:"/pages/ecosystem/allonahukuk.html"},
{keys:["danışmanlık","vize","ikamet"],url:"/pages/ecosystem/allonadanismanlik.html"},
{keys:["eğitim","kurs"],url:"/pages/ecosystem/allonaegitim.html"},
{keys:["kariyer","iş","cv"],url:"/pages/career/allonakariyer.html"},
{keys:["finans","kredi"],url:"/pages/ecosystem/allonafinans.html"},
{keys:["otomotiv","araç","araba"],url:"/pages/ecosystem/allonaotomotiv.html"},
{keys:["eğlence","etkinlik","konser","maç"],url:"/pages/ecosystem/allonaeglence.html"},
{keys:["evcil","pet","veteriner"],url:"/pages/ecosystem/allonaevcilhayvan.html"},
{keys:["teknoloji","telefon","bilgisayar"],url:"/pages/ecosystem/allonateknoloji.html"},
{keys:["spor","fitness"],url:"/pages/ecosystem/allonasporfitness.html"},
{keys:["güzellik","kozmetik"],url:"/pages/ecosystem/allonaguzellik.html"},
{keys:["sigorta","kasko","dask"],url:"/pages/ecosystem/allonasigorta.html"},
{keys:["kurye","teslimat"],url:"/pages/ecosystem/allonakurye.html"},
{keys:["ev hizmetleri","temizlik","usta"],url:"/pages/ecosystem/allonaevhizmetleri.html"},
{keys:["kargo","lojistik"],url:"/pages/ecosystem/allonalojistik.html"},
{keys:["nakliye","taşıma"],url:"/pages/ecosystem/allonanakliye.html"},
{keys:["organizasyon","düğün","nişan"],url:"/pages/ecosystem/allonaorganizasyon.html"},
{keys:["tarım","çiftçi","gübre","tohum"],url:"/pages/ecosystem/allonatarim.html"},
{keys:["inşaat","yapı","müteahhit"],url:"/pages/ecosystem/allonainsaat.html"},
{keys:["mühendislik","mühendis"],url:"/pages/ecosystem/allonamuhendislik.html"},
{keys:["trade","ithalat","ihracat"],url:"/pages/ecosystem/allonatrade.html"},
{keys:["otelcilik","otel","konaklama"],url:"/pages/ecosystem/allonaotelcilik.html"},
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
