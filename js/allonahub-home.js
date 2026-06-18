function updateHeroTime(){
const now=new Date();
const h=now.getHours();
const m=now.getMinutes();
const s=now.getSeconds();
const clock=document.getElementById("heroClock");
const greeting=document.getElementById("heroGreeting");
const visual=document.getElementById("timeVisual");
const pad=n=>String(n).padStart(2,"0");
clock.textContent=`${pad(h)}:${pad(m)}:${pad(s)}`;
const total=h*60+m;
visual.className="time-visual";
if(total>=300&&total<=720){greeting.textContent="Günaydın";visual.classList.add("sun-visual")}
else if(total>=721&&total<=1140){greeting.textContent="Merhaba";visual.classList.add("day-visual")}
else if(total>=1141&&total<=1380){greeting.textContent="İyi Akşamlar";visual.classList.add("evening-visual")}
else{greeting.textContent="İyi Geceler";visual.classList.add("night-visual")}
}
updateHeroTime();
setInterval(updateHeroTime,1000);

async function setLocationByBrowser(){
const cityEl=document.getElementById("heroCity");
const countryEl=document.getElementById("heroCountry");
if(!navigator.geolocation){return}
navigator.geolocation.getCurrentPosition(async function(pos){
const lat=pos.coords.latitude;
const lon=pos.coords.longitude;
try{
const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=tr`);
const data=await res.json();
const address=data.address||{};
cityEl.textContent=address.city||address.town||address.district||address.county||address.state||"Konum";
countryEl.textContent=address.country||"Türkiye";
}catch(e){
cityEl.textContent="İstanbul";
countryEl.textContent="Türkiye";
}
},function(){
cityEl.textContent="İstanbul";
countryEl.textContent="Türkiye";
});
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

const demoStats={activeUsers:12481,activeAds:1942,jobAds:326,crewApps:89,dailyHP:245800};
function formatNumber(num){return Number(num).toLocaleString("tr-TR")}
function updateLiveStats(data){
document.getElementById("activeUsers").textContent=formatNumber(data.activeUsers);
document.getElementById("activeAds").textContent=formatNumber(data.activeAds);
document.getElementById("jobAds").textContent=formatNumber(data.jobAds);
document.getElementById("crewApps").textContent=formatNumber(data.crewApps);
document.getElementById("dailyHP").textContent=formatNumber(data.dailyHP);
}
updateLiveStats(demoStats);

const searchRoutes=[
{keys:["shop","alışveriş","pazaryeri","ürün"],url:"allonashop.html"},
{keys:["yemek","restoran","burger","pizza"],url:"allonayemek.html"},
{keys:["market","süpermarket","gıda"],url:"allonamarket.html"},
{keys:["taksi","ulaşım"],url:"allonataksi.html"},
{keys:["sağlık","doktor","eczane"],url:"allonasaglik.html"},
{keys:["seyahat","otel","turizm","bilet"],url:"allonaseyahat.html"},
{keys:["gayrimenkul","ev","arsa","kiralık","satılık"],url:"allonagayrimenkul.html"},
{keys:["denizcilik","gemi","crew","maritime"],url:"allonadenizcilik.html"},
{keys:["hukuk","avukat"],url:"allonahukuk.html"},
{keys:["danışmanlık","vize","ikamet"],url:"allonadanismanlik.html"},
{keys:["eğitim","kurs"],url:"allonaegitim.html"},
{keys:["kariyer","iş","cv"],url:"allonakariyer.html"},
{keys:["finans","kredi"],url:"allonafinans.html"},
{keys:["otomotiv","araç","araba"],url:"allonaotomotiv.html"},
{keys:["eğlence","etkinlik","konser","maç"],url:"allonaeglence.html"},
{keys:["evcil","pet","veteriner"],url:"allonaevcilhayvan.html"},
{keys:["teknoloji","telefon","bilgisayar"],url:"allonateknoloji.html"},
{keys:["spor","fitness"],url:"allonasporfitness.html"},
{keys:["güzellik","kozmetik"],url:"allonaguzellik.html"},
{keys:["sigorta","kasko","dask"],url:"allonasigorta.html"},
{keys:["kurye","teslimat"],url:"allonakurye.html"},
{keys:["ev hizmetleri","temizlik","usta"],url:"allonaevhizmetleri.html"},
{keys:["kargo","lojistik"],url:"allonalojistik.html"},
{keys:["nakliye","taşıma"],url:"allonanakliye.html"},
{keys:["organizasyon","düğün","nişan"],url:"allonaorganizasyon.html"},
{keys:["tarım","çiftçi","gübre","tohum"],url:"allonatarim.html"},
{keys:["inşaat","yapı","müteahhit"],url:"allonainsaat.html"},
{keys:["mühendislik","mühendis"],url:"allonamuhendislik.html"},
{keys:["trade","ithalat","ihracat"],url:"allonatrade.html"},
{keys:["wallet","cüzdan","hp","pay"],url:"hubwallet.html"}
];

function globalSearch(){
const q=document.getElementById("globalSearchInput").value.toLowerCase().trim();
if(!q){return}
const found=searchRoutes.find(item=>item.keys.some(k=>q.includes(k)));
if(found){window.location.href=found.url}
else{window.location.href=["arama","html"].join(".")+"?q="+encodeURIComponent(q)}
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
