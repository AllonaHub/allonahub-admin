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
{title:"AVM Dünyası",eyebrow:"Alışveriş Merkezi",sentence:"Mağaza, etkinlik ve kampanya keşfini tek premium şehir ekranında yaşa.",href:"pages/ecosystem/allonaavm.html",image:"images/ads/hero-ad-avm-dunyasi.jpg",accent:"#ffd166",cta:"AVM'yi Keşfet"},
{title:"Seyahat & Turizm",eyebrow:"Seyahat",sentence:"Otel, bilet ve tur planlarını ferah bir keşif deneyimiyle düzenle.",href:"pages/ecosystem/allonaseyahat.html",image:"images/ads/hero-ad-seyahat.jpg",accent:"#28c7ff",cta:"Seyahati Planla"},
{title:"Gayrimenkul",eyebrow:"Emlak",sentence:"Satılık ve kiralık yaşam alanlarını güven veren ilan akışıyla incele.",href:"pages/ecosystem/allonagayrimenkul.html",image:"images/ads/hero-ad-gayrimenkul.jpg",accent:"#d6a21c",cta:"İlanları Gör"},
{title:"Denizcilik",eyebrow:"Maritime",sentence:"Gemi, crew ve denizcilik fırsatlarını profesyonel ağ içinde buluştur.",href:"pages/ecosystem/allonadenizcilik.html",image:"images/ads/hero-ad-denizcilik.jpg",accent:"#00b4d8",cta:"Denize Açıl"},
{title:"Hukuk",eyebrow:"Danışmanlık",sentence:"Avukat ve hukuki destek arayışını güvenilir başvuru akışıyla başlat.",href:"pages/ecosystem/allonahukuk.html",image:"images/ads/hero-ad-hukuk.jpg",accent:"#8ec5ff",cta:"Hukuki Destek Al"},
{title:"Danışmanlık",eyebrow:"Profesyonel Destek",sentence:"İş, belge ve süreç ihtiyaçların için doğru uzmana daha hızlı ulaş.",href:"pages/ecosystem/allonadanismanlik.html",image:"images/ads/hero-ad-danismanlik.jpg",accent:"#7bdff2",cta:"Uzman Bul"},
{title:"Eğitim",eyebrow:"Öğrenim",sentence:"Kursları, eğitimleri ve gelişim fırsatlarını tek öğrenme vitrininde keşfet.",href:"pages/ecosystem/allonaegitim.html",image:"images/ads/hero-ad-egitim.jpg",accent:"#7cdaff",cta:"Eğitime Başla"},
{title:"Kariyer",eyebrow:"İş Fırsatları",sentence:"Yeni iş ilanlarını ve kariyer fırsatlarını doğru aday akışıyla yakala.",href:"pages/career/allonakariyer.html",image:"images/ads/hero-ad-kariyer.jpg",accent:"#4cc9f0",cta:"İşleri Gör"},
{title:"Finans",eyebrow:"Finansal Çözümler",sentence:"Ödeme, bütçe ve finansal hizmetleri sade bir kontrol ekranında yönet.",href:"pages/ecosystem/allonafinans.html",image:"images/ads/hero-ad-finans.jpg",accent:"#58d68d",cta:"Finansı Keşfet"},
{title:"Otomotiv",eyebrow:"Araç",sentence:"Araç, servis ve mobilite çözümlerini güvenli otomotiv akışıyla incele.",href:"pages/ecosystem/allonaotomotiv.html",image:"images/ads/hero-ad-otomotiv.jpg",accent:"#ffbf69",cta:"Araçları Gör"},
{title:"Eğlence & Etkinlik",eyebrow:"Etkinlik",sentence:"Konser, festival ve şehir etkinliklerini canlı bir keşif alanında bul.",href:"pages/ecosystem/allonaeglence.html",image:"images/ads/hero-ad-eglence.jpg",accent:"#ff6bcb",cta:"Etkinlikleri Gör"},
{title:"Evcil Hayvan",eyebrow:"Pet",sentence:"Bakım, veteriner ve ürün ihtiyaçlarını sevgi dolu bir hizmet alanında topla.",href:"pages/ecosystem/allonaevcilhayvan.html",image:"images/ads/hero-ad-evcilhayvan.jpg",accent:"#f4a261",cta:"Pet Hizmetleri"},
{title:"Teknoloji",eyebrow:"Dijital",sentence:"Elektronik, yazılım ve dijital çözümleri modern teknoloji vitriniyle keşfet.",href:"pages/ecosystem/allonateknoloji.html",image:"images/ads/hero-ad-teknoloji.jpg",accent:"#64dfdf",cta:"Teknolojiye Git"},
{title:"Spor & Fitness",eyebrow:"Sağlıklı Yaşam",sentence:"Spor salonu, antrenman ve aktif yaşam fırsatlarını tek yerde yakala.",href:"pages/ecosystem/allonasporfitness.html",image:"images/ads/hero-ad-sporfitnes.jpg",accent:"#95d5b2",cta:"Spora Başla"},
{title:"Güzellik & Kozmetik",eyebrow:"Bakım",sentence:"Bakım, kozmetik ve güzellik randevularını premium görünümle keşfet.",href:"pages/ecosystem/allonaguzellik.html",image:"images/ads/hero-ad-guzellik.jpg",accent:"#ffafcc",cta:"Güzelliği Keşfet"},
{title:"Sigorta",eyebrow:"Güvence",sentence:"Araç, konut ve sağlık güvencelerini sade karşılaştırma deneyimiyle incele.",href:"pages/ecosystem/allonasigorta.html",image:"images/ads/hero-ad-sigorta.jpg",accent:"#90dbf4",cta:"Güvence Al"},
{title:"Kurye & Teslimat",eyebrow:"Teslimat",sentence:"Acil gönderileri hızlı kurye ağıyla güvenli şekilde yola çıkar.",href:"pages/ecosystem/allonakurye.html",image:"images/ads/hero-ad-kurye.jpg",accent:"#00f5d4",cta:"Kurye Çağır"},
{title:"Ev Hizmetleri",eyebrow:"Ev",sentence:"Temizlik, elektrik ve tadilat ihtiyaçlarını güvenilir ustalarla çöz.",href:"pages/ecosystem/allonaevhizmetleri.html",image:"images/ads/hero-ad-evhizmetleri.jpg",accent:"#f9c74f",cta:"Hizmet Bul"},
{title:"Kargo & Lojistik",eyebrow:"Lojistik",sentence:"Depo, taşıma ve operasyon süreçlerini tek lojistik akışında birleştir.",href:"pages/ecosystem/allonalojistik.html",image:"images/ads/hero-ad-lojistik.jpg",accent:"#00bbf9",cta:"Lojistiğe Git"},
{title:"Nakliye",eyebrow:"Taşıma",sentence:"Ev, ofis ve parça eşya taşımayı güven veren nakliye çözümleriyle planla.",href:"pages/ecosystem/allonanakliye.html",image:"images/ads/hero-ad-nakliye.jpg",accent:"#f9844a",cta:"Nakliye Planla"},
{title:"Organizasyon & Düğün",eyebrow:"Planlama",sentence:"Düğün, davet ve özel günlerini zarif organizasyon akışıyla hazırla.",href:"pages/ecosystem/allonaorganizasyon.html",image:"images/ads/hero-ad-organizasyon.jpg",accent:"#ffd6a5",cta:"Organize Et"},
{title:"Allona Tarım",eyebrow:"Tarım",sentence:"Tohum, gübre ve çiftçilik çözümlerini üretim odaklı bir alanda bul.",href:"pages/ecosystem/allonatarim.html",image:"images/ads/hero-ad-tarim.jpg",accent:"#80ed99",cta:"Tarıma Git"},
{title:"İnşaat & Yapı",eyebrow:"Yapı",sentence:"Proje, müteahhit ve yapı çözümlerini güçlü bir inşaat vitriniyle incele.",href:"pages/ecosystem/allonainsaat.html",image:"images/ads/hero-ad-insaatyapi.jpg",accent:"#adb5bd",cta:"Projeleri Gör"},
{title:"Mühendislik",eyebrow:"Teknik Proje",sentence:"Çizim, analiz ve teknik proje ihtiyaçlarını uzman mühendislerle buluştur.",href:"pages/ecosystem/allonamuhendislik.html",image:"images/ads/hero-ad-muhendislik.jpg",accent:"#5eead4",cta:"Mühendis Bul"},
{title:"Trade",eyebrow:"Global Ticaret",sentence:"İthalat, ihracat ve ticaret fırsatlarını global bağlantılarla büyüt.",href:"pages/ecosystem/allonatrade.html",image:"images/ads/hero-ad-trade.jpg",accent:"#fcbf49",cta:"Ticarete Başla"},
{title:"Otelcilik",eyebrow:"Konaklama",sentence:"Otel, tesis ve konaklama fırsatlarını profesyonel turizm akışıyla keşfet.",href:"pages/ecosystem/allonaotelcilik.html",image:"images/ads/hero-ad-otelcilik.jpg",accent:"#f4d35e",cta:"Otelcilik Gör"},
{title:"Allona Sağlık",eyebrow:"Sağlık",sentence:"Sağlık ve bakım hizmetlerini güven veren sade bir başvuru alanında bul.",href:"pages/ecosystem/allonasaglik.html",image:"images/ads/hero-ad-saglik.jpg",accent:"#70e000",cta:"Sağlığı Keşfet"}
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
image.alt="";
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
