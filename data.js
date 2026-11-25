// Apollo 11 motoros leereszkedés – valós adatok.
// Források:
//  [TEC]  NASA Technical Air-to-Ground Voice Transcription (AS11_TEC.PDF, 309–317. o.) – közkincs
//  [ALSJ] Apollo Lunar Surface Journal, "The First Lunar Landing" (apollojournals.org) – fedélzeti hangszalag időpontjai
//  [MR]   Apollo 11 Mission Report MSC-00171, 5-I. táblázat (eseménysor), 9-V, 9-XIII, B-I
//  [BEN]  Bennett: Apollo Lunar Descent and Ascent Trajectories, NASA TM X-58040
//  [LROC] LRO: Tranquility Base 0.67416° É, 23.47314° K
// Idő: GET (földi eltelt idő) 102:mm:ss alakban; UTC = 1969-07-16 13:32:00 + GET.

export const GET0 = 102 * 3600;                    // 102:00:00
export const PDI_GET = GET0 + 33 * 60 + 5.0;       // 102:33:05.0 DPS gyújtás
export const UTC_ZERO = Date.UTC(1969, 6, 16, 13, 32, 0);
export const T_START = GET0 + 32 * 60;             // lejátszás kezdete 102:32:00
export const T_END = GET0 + 47 * 60;               // vége 102:47:00
// Eredeti hang, a fájlok 0. másodperce = GET 102:32:00.
//  radio: NASA Public Affairs felvétel (apollojournals.org, a11a1023114-4746.mp3, közkincs),
//         a GET-időbélyeges irányítótermi szalaghoz keresztkorrelációval igazítva (+0,32% sebességkorrekció).
//  mocr:  Mission Control 30 sávos szalag T884b – CH14 CAPCOM-konzol + CH8 repülésirányító (Kranz) hurok,
//         Apollo 11 in Real Time (apolloinrealtime.org) "defluttered" változat.
export const AUDIO = {
  get0: GET0 + 32 * 60,
  tracks: [
    { id: 'radio', label: 'Hang: rádió', src: 'audio/radio.mp3' },
    { id: 'mocr', label: 'Hang: irányítóterem', src: 'audio/mocr.mp3' },
  ],
};

export const g = (s) => { const [m, x] = s.split(':'); return GET0 + (+m) * 60 + (+x); };
const t = (s) => g(s) - PDI_GET;                   // PDI-hez viszonyított másodperc

// --- Magasság-mérések (láb) [t, h, szórás] – MR, BEN, terv, Aldrin/Armstrong DSKY-bemondásai ---
export const ALT_OBS = [
  [-65, 49640, 200], [0, 49376, 60], [26, 49290, 150],            // PDI legjobb becslés [MR]
  [176, 45000, 700],                                               // tervezett forduló [BEN]
  [t('37:51'), 37000, 900],                                        // leszállóradar rögzít [BEN]
  [t('38:22'), 33500, 1400],                                       // első 1202 [ALSJ becslés]
  [t('39:31'), 23500, 900],                                        // tolóerő-visszavétel [MR ábra / terv]
  [t('39:50'), 21000, 900],
  [t('41:32'), 7129, 80],                                          // P64, "high gate" [MR]
  [t('41:51'), 5000, 150], [t('42:13'), 3000, 90], [t('42:29'), 2000, 70],
  [t('43:01'), 750, 25], [t('43:07'), 700, 20], [t('43:12'), 600, 20], [t('43:15.5'), 540, 20],
  [t('43:26'), 400, 15], [t('43:33'), 350, 12], [t('43:37'), 330, 12], [t('43:46'), 300, 10],
  [t('43:52'), 270, 10], [t('44:07'), 250, 10], [t('44:16'), 220, 8], [t('44:24'), 200, 8],
  [t('44:31'), 160, 8], [t('44:40'), 120, 6], [t('44:45'), 100, 5], [t('44:54'), 75, 5],
  [t('45:08'), 60, 5], [t('45:17'), 40, 4], [t('45:21'), 30, 3], [t('45:25'), 20, 3],
  [t('45:39.9'), 5.6, 0.6],                                        // kontaktfény: 1,7 m-es szondák érnek le
];
// --- Függőleges sebesség (láb/s) [t, hdot, szórás] ---
export const RATE_OBS = [
  [-65, -4, 3], [0, -4, 2], [26, -4, 3], [176, -50, 15], [t('39:31'), -110, 20],
  [t('41:32'), -125, 6], [t('41:51'), -100, 10], [t('42:13'), -70, 8], [t('42:29'), -50, 6],
  [t('43:01'), -23, 2], [t('43:07'), -21, 2], [t('43:12'), -19, 2], [t('43:15.5'), -15, 2],
  [t('43:26'), -9, 1.5], [t('43:33'), -4, 1.5], [t('43:37'), -3.5, 1.5], [t('43:46'), -3.5, 1],
  [t('43:52'), -1.5, 1], [t('44:07'), -2.5, 1], [t('44:16'), -3.5, 1], [t('44:24'), -4.5, 1],
  [t('44:26'), -5.5, 1], [t('44:31'), -6.5, 1], [t('44:33'), -5.5, 1], [t('44:45'), -3.5, 1],
  [t('44:54'), -0.5, 1], [t('45:08'), -2.5, 1], [t('45:17'), -2.5, 1], [t('45:21'), -2.5, 1],
  [t('45:25'), -0.5, 1], [t('45:39.9'), -1.7, 0.4],
];
// --- Vízszintes (előre) sebesség (láb/s) [t, v, szórás] – terv a fékezési szakaszra, utána bemondások ---
export const VEL_OBS = [
  [-65, 5566, 6], [0, 5560, 5], [26, 5529, 8], [176, 4000, 80], [t('39:31'), 1456, 60],
  [t('41:32'), 506, 30], [t('43:22'), 55, 8], [t('43:26'), 58, 5], [t('43:46'), 47, 4],
  [t('44:07'), 19, 3], [t('44:16'), 13, 2], [t('44:23'), 11, 2], [t('44:33'), 9, 2],
  [t('44:45'), 9, 2], [t('44:54'), 6, 2], [t('45:08'), 2, 1.5], [t('45:25'), 4, 1.5],
  [t('45:39.9'), 0.4, 0.8],
];
// --- Hátralévő táv a tényleges leszállási pontig (láb) [t, táv, szórás] ---
export const RANGE_OBS = [
  [0, 1578000, 25000],          // ~260 tengeri mérföld (PDI 39,37° K → 23,47° K)
  [t('41:32'), 26000, 1500],    // high gate [BEN 21. ábra]
  [t('43:22'), 3000, 350],      // P66: ~2000 ft a gépi célpont előtt + 1100 ft túlrepülés [BEN, MR]
];
// --- Dőlésszög a függőlegestől (fok; + = hátra dőlve, fékez) [BEN, MR 5-5. ábra] ---
export const PITCH_KNOTS = [
  [-65, 92], [0, 92], [26, 92], [200, 85], [t('38:20'), 78], [t('40:20'), 59], [t('41:32'), 55],
  [t('41:45'), 45], [t('42:30'), 36], [t('43:15'), 18], [t('43:22'), 11], [t('43:27'), 6],
  [t('43:40'), 5], [t('43:50'), 16], [t('44:05'), 16], [t('44:15'), 7], [t('45:20'), 4],
  [t('45:39'), 1], [t('45:43'), 0],
];
// Ablakkal lefelé → felfelé fordulás (180° a tolóerő-tengely körül) [MR 5-I]: 102:36:47 – 102:37:59
export const YAW_START = t('36:47'), YAW_END = t('37:59');
export const YAW_FINAL_LEFT = 13; // a végső megközelítésben ~13° balra elfordítva [ALSJ]

// --- Tolóerő, tömeg, hajtóanyag [MR, sajtócsomag] ---
export const VEH = {
  mass0: 33401.6 * 0.45359237,       // kg, DOI után (PDI-hez legközelebbi táblázati érték)
  massLand: 16153.2 * 0.45359237,    // kg, leszálláskor
  propPDI: 17900 * 0.45359237,       // kg (18 184 lb feltöltve − ~268 lb DOI)
  propLoaded: 18184 * 0.45359237,
  propCutoff: 770 * 0.45359237,      // kg a hajtómű leállításakor
  thrustMax: 10500 * 4.4482216,      // N (tervezési maximum; 100%)
  thrustFTP: 9870 * 4.4482216,       // N (fix, teljes tolóerő-állás ~94%)
  minThrottle: 0.13,                 // gyújtás utáni 26 s [MR: 13%, a legénység: "10 százalék"]
  isp: 311,
};

export const EVENTS = [
  // [GET, rövid címke, leírás, ugrás-jelölő?]
  [g('32:58'), 'Ullage', 'Üzemanyag-ülepítő RCS-gyújtás', 0],
  [g('33:05'), 'PDI', 'Motoros leereszkedés kezdete – a DPS begyullad (102:33:05.01)', 1],
  [g('33:31'), 'FTP', 'Teljes tolóerő (fix állás) a 26. másodpercben', 0],
  [g('36:47'), 'Fordulás', 'Forgás ablakkal felfelé (102:36:47–102:37:59)', 1],
  [g('37:51'), 'Radar', 'A leszállóradar adatai jók', 0],
  [g('38:22'), '1202', 'Első programriasztás: 1202 – a vezérlőgép túlterhelt', 1],
  [g('39:02'), '1202', 'Újabb 1202 riasztás', 0],
  [g('39:31'), 'Visszavétel', 'Tolóerő-visszavétel (386 s, terv: 384 s)', 1],
  [g('41:32'), 'P64', 'Megközelítési szakasz – az LM felbillen, látszik a leszállóhely', 1],
  [g('42:18'), '1201', '1201 riasztás', 0],
  [g('42:43'), '1202', '1202 riasztás', 0],
  [g('42:58'), '1202', '1202 riasztás', 0],
  [g('43:13'), 'ATT HOLD', 'Armstrong kézi irányításra vált – sziklás terület', 0],
  [g('43:22'), 'P66', 'Félig kézi leszállás: Armstrong átrepüli a West-kráter sziklamezőjét', 1],
  [g('44:30.4'), 'Low level', 'Alacsony üzemanyagszint-jelző kigyullad', 1],
  [g('45:39.9'), 'Kontakt', 'Kontaktfény – a szondák elérik a felszínt', 0],
  [g('45:41.4'), 'Leállás', 'DPS leállítás (756,4 s égés)', 0],
  [g('46:04'), 'Leszállt', '„The Eagle has landed.”', 1],
];

export const ALARMS = [ // PROG lámpa + kód a DSKY-n
  [g('38:22'), '1202'], [g('39:02'), '1202'], [g('42:18'), '1201'], [g('42:43'), '1202'], [g('42:58'), '1202'],
];
export const PROGRAMS = [[T_START, 'P63'], [g('41:32'), 'P64'], [g('43:22'), 'P66'], [g('45:48'), 'P68']];
export const LOW_LEVEL = g('44:30.4');
export const BINGO = LOW_LEVEL + 94;           // a "bingó" (20 s-on belül le kell szállni vagy megszakítani)
export const CONTACT = g('45:39.9');
export const ENGINE_OFF = g('45:41.4');

export const SITE = { lat: 0.67416, lon: 23.47314, elev: -1927.9 };
// A 3D keret +x tengelye a PDI felé mutat (a leszállóhelytől 88,58°-os azimuttal, 482 km-re) – így a pálya a valós nyomvonalon fut.
export const FRAME_AZ = 88.58134533;
export const DEM_META = 'dem/meta.json';
export const SUN = { alt: 10.65, az: 88.81 };
export const EARTH = { alt: 59.43, az: 272.16 };

// Nevezett kráterek a leszállóhely körül (m; x = kelet, z = dél) – közelítő helyek [LROC, ALSJ]
export const NAMED_CRATERS = [
  { name: 'West', x: 480, z: -90, r: 92, fresh: 0.8 },
  { name: 'Little West', x: 57, z: 6, r: 16.5, fresh: 0.58 },
  { name: 'Double (K)', x: -14, z: 16, r: 3.2, fresh: 0.55 },
  { name: 'Double (Ny)', x: -20, z: 12, r: 3.0, fresh: 0.55 },
];

// --- Rádióforgalom: [idő, ki, eredeti, magyar, i = csak fedélzeti hangszalag] ---
// CDR = Armstrong, LMP = Aldrin, CC = Duke (CAPCOM), CMP = Collins.
export const TRANSCRIPT = [
  ['32:03', 'LMP', 'Say again the angles, though.', 'Ismételd meg a szögeket.'],
  ['32:08', 'CC', 'Roger. Pitch 212, yaw plus 37.', 'Vettem. Bólintás 212, legyezés plusz 37.'],
  ['32:24', 'LMP', "OMNI's in.", 'OMNI antenna bekapcsolva.'],
  ['32:50', 'CDR', 'Descent armed.', 'Leszállómotor élesítve.', 'i'],
  ['33:11', 'CDR', 'Ignition.', 'Gyújtás.', 'i'],
  ['33:09', 'LMP', '... 10 ... 10 percent ...', '… 10 … 10 százalék …'],
  ['33:25', 'LMP', '24, 25, 26, Throttle up.', '24, 25, 26 – teljes tolóerő.', 'i'],
  ['33:41', 'CC', "Columbia, Houston. We've lost them. Tell them to go aft OMNI. Over.", 'Columbia, itt Houston. Elvesztettük őket. Szólj, hogy váltsanak a hátsó OMNI-ra.'],
  ['33:51', 'CMP', "They've lost you. Use the OMNI's again.", 'Elvesztettek titeket. Használjátok újra az OMNI-t.'],
  ['34:07', 'LMP', "I'll leave it in SLEW. Relay to us. See if they have got me now.", 'SLEW-ben hagyom. Továbbítsd. Nézd meg, most hallanak-e.'],
  ['34:16', 'CC', "Eagle, we've got you now. It's looking good. Over.", 'Eagle, most már megvagytok. Jól néz ki.'],
  ['34:24', 'LMP', '- - descent looks good.', '… a leereszkedés jól néz ki.'],
  ['34:34', 'CC', 'Eagle, Houston. After yaw around, angles: S-band pitch, minus 9, yaw plus 18.', 'Eagle, Houston. Fordulás utáni szögek: S-sáv bólintás −9, legyezés +18.'],
  ['34:59', 'LMP', 'AGS and PNGS agree very closely.', 'Az AGS és a PNGS nagyon közel egyezik.'],
  ['35:14', 'LMP', 'Data, On. Altitude\'s a little high.', 'Adat bekapcsolva. A magasság kicsit nagy.'],
  ['35:54', 'CC', "Looking good to us. You're still looking good at 3, coming up 3 minutes.", 'Nálunk jól néz ki. 3 percnél is jól álltok.'],
  ['36:18', 'CDR', 'Our position checks downrange show us to be a little long.', 'A pozícióellenőrzés szerint kicsit túlrepülünk.'],
  ['36:46', 'CDR', '... about 3 seconds long. Rolling over.', '… kb. 3 másodperccel hosszabb. Átfordulunk.', 'i'],
  ['37:22', 'CC', 'Roger. You are GO - You are GO to continue powered descent.', 'Vettem. Mehettek tovább a motoros leereszkedéssel.'],
  ['37:35', 'CC', "And, Eagle, Houston. We've got data dropout. You're still looking good.", 'Eagle, Houston. Kiesett az adat. Továbbra is jól álltok.'],
  ['38:04', 'LMP', 'We got good lock-on. Altitude lights OUT. DELTA-H is minus 2 900.', 'A radar rögzített. Magasságjelző kialudt. Delta-H: mínusz 2900.'],
  ['38:20', 'LMP', 'Got the Earth right out our front window.', 'A Föld pont az elülső ablakunkban.'],
  ['38:23', 'CDR', "Houston, you're looking at our DELTA-H?", 'Houston, látjátok a Delta-H-nkat?'],
  ['38:26', 'CDR', 'PROGRAM ALARM.', 'PROGRAMRIASZTÁS.'],
  ['38:28', 'CC', "It's looking good to us. Over.", 'Nálunk jól néz ki.'],
  ['38:30', 'CDR', "It's a 1202.", '1202-es.'],
  ['38:48', 'CDR', 'Give us a reading on the 1202 PROGRAM ALARM.', 'Mondjatok valamit az 1202-es riasztásról.'],
  ['38:53', 'CC', "Roger. We got - We're GO on that alarm.", 'Vettem. Arra a riasztásra mehettek.'],
  ['39:01', 'CC', '6 plus 25, throttle down - - 6 plus 25, throttle down.', '6:25-nél tolóerő-visszavétel.'],
  ['39:14', 'LMP', 'Same alarm, and it appears to come up when we have a 1668 up.', 'Ugyanaz a riasztás; úgy tűnik, akkor jön, amikor a 16/68 kijelzés fut.'],
  ['39:30', 'CC', 'Roger. DELTA-H is looking good to us.', 'Vettem. A Delta-H nálunk jól néz ki.'],
  ['39:34', 'LMP', 'Ah! Throttle down - -', 'Á! Visszavétel…'],
  ['39:35', 'CDR', 'Throttle down on time!', 'Visszavétel pontosan időben!'],
  ['39:38', 'LMP', '- - throttles down. Better than the simulator.', '…visszavesz. Jobb, mint a szimulátorban.'],
  ['39:48', 'LMP', 'AGS and PGNS look real close.', 'Az AGS és a PGNS nagyon közel van.'],
  ['40:08', 'CC', "At 7 minutes, you're looking great to us, Eagle.", 'Hét percnél nagyszerűen álltok, Eagle.'],
  ['40:13', 'LMP', "I'm still on SLEW so we may tend to lose as we gradually pitch over.", 'Még SLEW-ben vagyok, a felbillenéskor elveszíthetjük a jelet.'],
  ['40:49', 'CC', "Eagle, Houston. It's descent 2 fuel to MONITOR. Over.", 'Eagle, Houston. Üzemanyag-kijelzőt a 2-es tartályra.'],
  ['40:55', 'CDR', 'Going to 2.', 'Váltok a 2-esre.'],
  ['41:05', 'CC', "You're looking great at 8 minutes.", 'Nyolc percnél nagyszerűen álltok.'],
  ['41:12', 'CC', "Eagle, you've got 30 seconds to P64.", 'Eagle, 30 másodperc a P64-ig.'],
  ['41:35', 'CDR', 'P64.', 'P64.'],
  ['41:51', 'CC', "Eagle, you're looking great. Coming up 9 minutes.", 'Eagle, nagyszerűen álltok. Mindjárt 9 perc.'],
  ['41:51', 'CDR', '[5000 ft, 100 ft/s] ... is good.', '5000 láb, 100 láb/s – jó.', 'i'],
  ['42:05', 'CDR', 'Manual attitude control is good.', 'A kézi helyzetszabályozás jó.'],
  ['42:10', 'CC', "Eagle, Houston. You're GO for landing. Over.", 'Eagle, Houston. Mehettek a leszállásra.'],
  ['42:13', 'CDR', '3000 at 70.', '3000 lábon 70.', 'i'],
  ['42:17', 'LMP', 'Roger. Understand. GO for landing. 3000 feet. PROGRAM ALARM.', 'Vettem. Mehetünk leszállni. 3000 láb. PROGRAMRIASZTÁS.'],
  ['42:22', 'LMP', '1201', '1201'],
  ['42:25', 'CC', "Roger. 1201 alarm. We're GO. Same type. We're GO.", 'Vettem, 1201. Mehettek. Ugyanaz a típus. Mehettek.'],
  ['42:31', 'LMP', '2000 feet. 2000 feet. Into the AGS, 47 degrees.', '2000 láb. Az AGS-be: 47 fok.'],
  ['42:32', 'CDR', 'Give me an LPD.', 'Adj egy LPD-t (leszállási pont szöget).', 'i'],
  ['42:36', 'LMP', '47 degrees.', '47 fok.'],
  ['42:41', 'CC', "Eagle, looking great. You're GO.", 'Eagle, nagyszerű. Mehettek.'],
  ['42:58', 'CC', 'Roger. 1202. We copy it.', 'Vettem, 1202.'],
  ['43:01', 'LMP', '35 degrees. 35 degrees. 750. Coming down to 23.', '35 fok. 750 láb, 23 láb/s süllyedés.'],
  ['43:07', 'LMP', '700 feet, 21 down, 33 degrees.', '700 láb, 21 lefelé, 33 fok.'],
  ['43:10', 'CDR', 'Pretty rocky area.', 'Elég sziklás terület.', 'i'],
  ['43:11', 'LMP', '600 feet, down at 19.', '600 láb, 19-cel süllyed.'],
  ['43:15', 'LMP', '540 feet, down at - 30. Down at 15.', '540 láb … 15-tel süllyed.'],
  ['43:26', 'LMP', 'At 400 feet, down at 9.', '400 lábon 9-cel süllyed.'],
  ['43:29', 'LMP', '58 forward.', '58 előre.'],
  ['43:33', 'LMP', '350 feet, down at 4.', '350 láb, 4-gyel süllyed.'],
  ['43:35', 'LMP', '330, three and a half down.', '330, három és fél lefelé.'],
  ['43:42', 'LMP', "We're pegged on horizontal velocity.", 'A vízszintes sebességmutató végállásban.'],
  ['43:46', 'LMP', '300 feet, down 3 1/2, 47 forward.', '300 láb, 3,5 lefelé, 47 előre.'],
  ['43:52', 'LMP', '1 1/2 down. Ease her down. 270.', '1,5 lefelé. Óvatosan le vele. 270.'],
  ['44:00', 'LMP', 'Eight percent.', 'Nyolc százalék (üzemanyag).', 'i'],
  ['44:04', 'LMP', 'I got the shadow out there.', 'Látom az árnyékunkat odakint.'],
  ['44:07', 'LMP', '250, down at 2 1/2, 19 forward.', '250, 2,5-del süllyed, 19 előre.'],
  ['44:13', 'LMP', 'Altitude-velocity light.', 'Magasság–sebesség jelzőfény.'],
  ['44:16', 'LMP', '3 1/2 down, 220 feet, 13 forward.', '3,5 lefelé, 220 láb, 13 előre.'],
  ['44:23', 'LMP', '11 forward. Coming down nicely.', '11 előre. Szépen jön le.'],
  ['44:24', 'LMP', '200 feet, 4 1/2 down.', '200 láb, 4,5 lefelé.'],
  ['44:25', 'CDR', 'Gonna be right over that crater.', 'Pont a kráter fölött leszünk.', 'i'],
  ['44:26', 'LMP', '5 1/2 down.', '5,5 lefelé.'],
  ['44:31', 'LMP', '160, 6 - 6 1/2 down.', '160, 6–6,5 lefelé.'],
  ['44:33', 'LMP', "5 1/2 down, 9 forward. That's good.", '5,5 lefelé, 9 előre. Ez jó.'],
  ['44:40', 'LMP', '120 feet.', '120 láb.'],
  ['44:45', 'LMP', '100 feet, 3 1/2 down, 9 forward. Five percent. Quantity light.', '100 láb, 3,5 lefelé, 9 előre. Öt százalék. Üzemanyag-jelzőfény.'],
  ['44:54', 'LMP', "Okay. 75 feet. There's looking good. Down a half, 6 forward.", 'Oké. 75 láb. Jól néz ki. Fél lefelé, 6 előre.'],
  ['45:02', 'CC', '60 seconds.', '60 másodperc (a bingóig).'],
  ['45:04', 'LMP', 'Lights on. ...', 'Lámpák be. …'],
  ['45:08', 'LMP', '60 feet, down 2 1/2. 2 forward. 2 forward. Good.', '60 láb, 2,5 lefelé. 2 előre. Jó.'],
  ['45:17', 'LMP', '40 feet, down 2 1/2. Kicking up some dust.', '40 láb, 2,5 lefelé. Felveri a port.'],
  ['45:21', 'LMP', '30 feet, 2 1/2 down. Faint shadow.', '30 láb, 2,5 lefelé. Halvány árnyék.'],
  ['45:25', 'LMP', '4 forward. 4 forward. Drifting to the right a little. 20 feet, down a half.', '4 előre. Kicsit jobbra sodródunk. 20 láb, fél lefelé.'],
  ['45:31', 'CC', '30 seconds.', '30 másodperc.'],
  ['45:32', 'CDR', 'Forward drift?', 'Előre sodródás?'],
  ['45:33', 'LMP', 'Yes.', 'Igen.'],
  ['45:40', 'LMP', 'CONTACT LIGHT.', 'KONTAKTFÉNY.'],
  ['45:43', 'CDR', 'Shutdown.', 'Leállítás.', 'i'],
  ['45:43', 'LMP', 'Okay. ENGINE STOP.', 'Oké. MOTOR LEÁLLÍTVA.'],
  ['45:45', 'LMP', 'ACA - out of DETENT.', 'Kormánykar – reteszből ki.'],
  ['45:46', 'CDR', 'Out of DETENT.', 'Reteszből ki.'],
  ['45:47', 'LMP', 'MODE CONTROL - both AUTO. DESCENT ENGINE COMMAND OVERRIDE - OFF. ENGINE ARM - OFF.', 'Üzemmód: mindkettő AUTO. Leszállómotor-felülbírálás KI. Motorélesítés KI.'],
  ['45:52', 'LMP', '413 is in.', 'A 413 beírva.'],
  ['45:57', 'CC', 'We copy you down, Eagle.', 'Vettük, hogy lent vagytok, Eagle.'],
  ['45:59', 'CDR', 'Houston, Tranquility Base here.', 'Houston, itt a Nyugalom Bázis.'],
  ['46:04', 'CDR', 'THE EAGLE HAS LANDED.', 'A SAS LESZÁLLT.'],
  ['46:06', 'CC', 'Roger, Tranquility. We copy you on the ground. You got a bunch of guys about to turn blue. We\'re breathing again. Thanks a lot.', 'Vettem, Nyugalom. Látjuk, hogy lent vagytok. Itt egy csomó srác már kezdett elkékülni. Újra lélegzünk. Köszönjük.'],
  ['46:16', 'LMP', 'Thank you.', 'Köszönjük.'],
  ['46:18', 'CC', "You're looking good here.", 'Itt minden jól néz ki.'],
  ['46:23', 'CDR', "Okay. We're going to be busy for a minute.", 'Oké. Egy percig most elfoglaltak leszünk.'],
].map(([tm, who, en, hu, flag]) => ({ t: g(tm), who, en, hu, intercom: flag === 'i' })).sort((a, b) => a.t - b.t);
