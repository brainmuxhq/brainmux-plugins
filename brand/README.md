# brand — logo kaynağı (tek klasör)

Bütün ürün logolarının TEK kaynağı burası: `<ürün>.svg`. Proje kendi kopyasını elle tutmaz; buradan alır (kopya gerekiyorsa betikle üretilir).

Ortak iskelet: 32×32 ızgara, köşe yuvarlaklığı rx 7, içerik kenardan en az 4 birim içeride. Aile müşteriye göre:
- **-matik** (İSG/OSGB'ye satılan ürünler): lacivert `#0F172A` kare, beyaz kalın (çizgi 5) tek harf. Markada brainmux görünmez; yalnız alt bilgide "bir brainmux ürünü". Dosyalar: `riskmatik.svg`, `atexmatik.svg`.
- **-mux** (brainmux platformu ve araçları): `#08090c` zemin, renkli tek çizgi kavram ikonu, çizgi 2,5, harf yok. Dosyalar: `brainmux.svg` (teal `#4FD1C5`), `llmproxy.svg` (amber `#E8B341`), `graphmux.svg` (iris `#8B8CF9`).
- Yeni logo önce bu kurala göre buraya girer; ofismux ikonu kural oturunca ayrı kararla.
- brainmux.com site ikonu `brainmux.svg`'den üretilir: `npm run ikon` (brainmux/web).

## PNG üretimi (PNG'ler git'e girmez, kaynaktan üretilir)
```bash
rsvg-convert -w 400 -h 80 riskmatik-logo.svg -o riskmatik-logo-400x80.png   # yatay logo, oran 5:1 (iyzico logo URL'si bu boyut)
rsvg-convert -w 512 riskmatik.svg -o riskmatik-512.png                       # kare ikon, herhangi bir ürün
```
