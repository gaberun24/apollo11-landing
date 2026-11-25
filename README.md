# Apollo 11 · Eagle – a holdraszállás valós időben

Az Apollo 11 holdkomp motoros leereszkedése és leszállása WebGL-ben (three.js), **1:1 valós időben**, a NASA eredeti adataiból: GET 102:32:00 → 102:47:00, vagyis 1969. július 20., 20:04–20:19 UTC. A 102:33:05-ös gyújtástól a 102:45:39,9-es kontaktfényig ugyanúgy 12 perc 35 másodperc telik el, mint akkor.

*English: a real-time (1:1) WebGL replay of the Apollo 11 powered descent, driven by NASA telemetry, the original air-to-ground and Mission Control audio, and LRO lunar terrain data (SLDEM2015 + LROC NAC DTM).*

## Funkciók

- **Pálya a valós adatokból.** Felhasznált források:
  - a Mission Report eseménysora;
  - Aldrin és Armstrong DSKY-bemondásai (magasság, süllyedési és előre haladási sebesség);
  - a fékezési szakaszra a NASA tervezett pályája.

  A mérési pontokra súlyozott simító spline illeszkedik (ezt a böngésző számolja). Ebből jön a tolóerő, a tömeg és a fogyasztás. Ellenőrzésként: a számolt fogyasztás 2,4%-on belül egyezik a ténylegessel.
- **Telemetria.** Magasság, sebességek, tolóerő, dőlésszög, hajtóanyag, DSKY-kijelző a valós időpontú 1202/1201 riasztásokkal, és visszaszámlálás a „bingó”-ig.
- **Rádióforgalom.** Szó szerint a NASA TEC-átiratából, magyar fordítással.
- **Eredeti hang, két sávon:**
  - a NASA közszolgálati adása (amit a világ hallott);
  - az irányítóterem szalagja (CAPCOM-konzol és Gene Kranz repülésirányítói hurka).

  A két sáv ±0,03 s-on belül szinkronban van egymással és a küldetésidővel.
- **Valós domborzat:**
  - SLDEM2015 (LOLA + Kaguya) a pálya mentén, ~474 m és ~118 m felbontással;
  - LROC NAC DTM 2 m-es felbontással a leszállóhely ±2 km-es körzetében, a valódi West- és Little West-kráterrel;
  - a vetett árnyékok előre számoltak a valós napállásra (10,65°).
- **Négy kameranézet:** követő, Armstrong ablaka, profil, felszínről.
- **Világhoz rögzített LOD-terep (CDLOD).** Kamera körüli csúszó rács helyett világhoz rögzített foltok, így a terep nem „úszik” mozgás közben.

## Futtatás

Az ES-modulok miatt HTTP-szerver kell (a `file://` nem működik):

```
python -m http.server 8000
```

Ezután nyisd meg: http://localhost:8000

Billentyűk:
- szóköz: lejátszás/szünet;
- ←/→: ±10 s (Shifttel ±60 s);
- 1–4: kameranézetek.

## Szerkezet

| Fájl | Tartalom |
|---|---|
| `index.html` | HUD, idővonal, stílusok |
| `main.js` | jelenet, kamerák, HUD-frissítés, hangszinkron |
| `data.js` | valós adatok: átirat, események, mérési pontok, források |
| `traj.js` | pályaillesztés és levezetett fizikai mennyiségek |
| `terrain.js` | CDLOD terep, holdi fényvisszaverés (Lommel–Seeliger + oppozíciós effektus), procedurális apró kráterek |
| `dem.js` | a valós domborzat betöltése és mintavétele (GLSL + JS) |
| `lm.js` | az Eagle egyszerűsített modellje |
| `scene.js` | Föld, csillagok, sziklák, por, pályavonal |
| `audio/` | `radio.mp3` (NASA PAO), `mocr.mp3` (irányítóterem) |
| `dem/` | domborzat int16 adatfolyamként, veszteségmentes RGB PNG-be csomagolva, ellenőrzőösszeggel |
| `tools/` | a letöltő és feldolgozó scriptek (DEM és hang) |

### Az adatok újragenerálása

- `tools/fetch_dem.py <cél> nac|s256|s128|wac`: csak a szükséges sorszeleteket tölti le HTTP Range kérésekkel a NASA PDS-ről.
- `tools/proc_dem.py <forrás> <dem-mappa>`: magasságok a leszállóhelyhez viszonyítva, vetett árnyékok, a máig ott álló leszállási fokozat púpjának kisimítása, tömörítés.
- `tools/bin2png.py <dem-mappa>`: a tömörített adatfolyam PNG-be csomagolása.
- `tools/xcorr.py`: a hangsávok keresztkorrelációs igazítása.

## Források

- **Rádióforgalom:** NASA Technical Air-to-Ground Voice Transcription (TEC), közkincs; a fedélzeti sorok időpontjai az [Apollo Lunar Surface Journal](https://apollojournals.org/alsj/a11/a11.landing.html) alapján.
- **Eseményidők, tömeg, hajtóanyag:** [Apollo 11 Mission Report, MSC-00171](https://apollojournals.org/alsj/a11/a11MIssionReport_1971015566.pdf).
- **Tervezett pálya és dőlésszög:** Bennett, *Apollo Lunar Descent and Ascent Trajectories*, [NASA TM X-58040](https://ntrs.nasa.gov/api/citations/19700024568/downloads/19700024568.pdf).
- **NASA közszolgálati hang:** `a11a1023114-4746.mp3`, Apollo Lunar Surface Journal, közkincs.
- **Irányítótermi hang:** az [Apollo 11 in Real Time](https://apolloinrealtime.org/11/) (Ben Feist és munkatársai) „defluttered” szalagjai, T884b CH14 + CH8. Az eredeti felvételek a NASA-éi; a feldolgozott változat a forrásoldal szerint CC BY-NC-SA 3.0, így az `audio/mocr.mp3` is e feltételekkel használható: forrásmegjelöléssel, nem kereskedelmi célra, azonos licenccel.
- **Domborzat:**
  - SLDEM2015 (LRO LOLA + SELENE Kaguya TC), [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/missions/lro/lola.htm);
  - LROC NAC DTM Apollo 11 (NASA/GSFC/Arizona State University), [NASA PDS](https://wms.lroc.asu.edu/lroc/view_rdr/NAC_DTM_APOLLO11).
- **Leszállóhely koordinátái:** LROC (0,67416° É, 23,47314° K).
- **3D motor:** [three.js](https://threejs.org) 0.160 (MIT), CDN-ről.

## Ismert közelítések

- A felszín világosságát (albedó) a program generálja. A valós WAC-albedótérkép letöltését a NASA szervere ideiglenesen korlátozta.
- A domborzati adatok felbontása alatti apró kráterek és a sziklák elhelyezése szemléltető.
- A pálya az oldalirányú eltérést (~120 m) nem követi.
- Az átirat időbélyegei pár másodpercet tévedhetnek.
- A fékezési szakasz köztes értékei ±5–10%-os pontosságúak.
