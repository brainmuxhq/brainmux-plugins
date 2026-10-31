# brand — logo kaynağı (tek klasör)

Bütün ürün logolarının TEK kaynağı burası: `<ürün>.svg`. Proje kendi kopyasını elle tutmaz; buradan alır (kopya gerekiyorsa betikle üretilir).

Ortak iskelet: 32×32 ızgara, köşe yuvarlaklığı rx 7, içerik kenardan en az 4 birim içeride. Aile müşteriye göre:
- **-matik** (İSG/OSGB'ye satılan ürünler): lacivert `#0F172A` kare, beyaz kalın (çizgi 5) tek harf. Markada brainmux görünmez; yalnız alt bilgide "bir brainmux ürünü". Dosyalar: `riskmatik.svg`, `atexmatik.svg`.
- **-mux** (brainmux platformu ve araçları): `#08090c` zemin, renkli tek çizgi kavram ikonu, çizgi 2,5, harf yok. Dosyalar: `brainmux.svg` (teal `#4FD1C5`), `llmproxy.svg` (amber `#E8B341`), `graphmux.svg` (iris `#8B8CF9`), `ofismux.svg` (mercan `#F4796B`), `scoutmux.svg` (yeşil `#7DD87F`), `fleetmux.svg` (mavi `#5AB0F5`).
- **-mux aile deseni:** hep aynı = girdi düğümü (6,2·16) + kuyruk + merkez düğüm (15·16, r 3,1), brainmux'tan birebir. Ürüne göre değişen = merkezden sağa çıkan kısım (dal biçimi + tek ayırt edici öğe) ve ürün rengi. Yeni -mux ürün çekirdeği alır, sağ tarafı kendi kavramıyla çizer; ofismux sağ ucu çizgili köşesi kesik sayfa (dolgusuz blok 16 px'te leke olur).
- Yeni logo önce bu kurala göre buraya girer; ofismux ikonu kural oturunca ayrı kararla.
- brainmux.com site ikonu `brainmux.svg`'den üretilir: `npm run ikon` (brainmux/web).

## PNG üretimi (PNG'ler git'e girmez, kaynaktan üretilir)
```bash
rsvg-convert -w 400 -h 80 riskmatik-logo.svg -o riskmatik-logo-400x80.png   # yatay logo, oran 5:1 (iyzico logo URL'si bu boyut)
rsvg-convert -w 512 riskmatik.svg -o riskmatik-512.png                       # kare ikon, herhangi bir ürün
```
