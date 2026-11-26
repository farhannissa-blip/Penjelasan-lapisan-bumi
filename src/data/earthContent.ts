export type LayerId =
  | 'kerak'
  | 'mantel'
  | 'inti-luar'
  | 'inti-dalam'
  | 'litosfer'
  | 'hidrosfer'
  | 'atmosfer'
  | 'biosfer';

export type LayerCategory = 'lapisan-dalam' | 'komponen-bumi';

export interface CameraFocusPreset {
  azimuth: number;
  polar: number;
  distance: number;
  recommendedCutaway: number;
}

export type AtmosSubLayerId = 'troposfer' | 'stratosfer' | 'mesosfer' | 'termosfer';

export interface SurfaceSubLayer {
  id?: AtmosSubLayerId;
  name: string;
  range: string;
  short3dHint?: string;
  detail: string;
  narration?: string;
  accentHex: string;
}

export interface EarthLayerInfo {
  id: LayerId;
  name: string;
  englishName: string;
  category: LayerCategory;
  categoryLabel: string;
  accentHex: string;
  shortTagline: string;
  thickness: string;
  thicknessKmApprox: number;
  percentOfRadius: number;
  temperature: string;
  stateAndMaterial: string;
  keyFunction: string;
  summary: string;
  bulletPoints: string[];
  subLayers?: SurfaceSubLayer[];
  funFact: string;
  astroDialogue: string;
  narrationScript: string;
  camera: CameraFocusPreset;
}

export const ASTRO_BUMI_INTRO =
  'Hallo, penjelajah! Tahukah kamu bahwa Bumi yang kita tinggali ternyata memiliki bagian dalam yang berlapis-lapis? Yuk, buka potongan Bumi atau klik langsung lapisannya!';

export const ASTRO_BUMI_WHOLE =
  'Ini adalah planet Bumi kita yang utuh! Tekan "Buka Potongan" atau "Jelajahi Bagian Dalam Bumi" untuk mengintip rahasia di dalamnya.';

export const SURFACE_BUMI_INTRO =
  'Selamat datang di Scene 3D Komponen Permukaan Bumi! Klik langsung pegunungan (Litosfer), laut & sungai (Hidrosfer), hutan & desa (Biosfer), atau lapisan udara (Atmosfer) untuk menjelajahinya!';

export const SURFACE_TOUR_INTRO =
  'Ayo kita amati lapisan komponen permukaan Bumi secara langsung! Permukaan Bumi tersusun atas empat komponen utama yang saling terhubung: Litosfer di daratan, Hidrosfer di perairan, Biosfer tempat makhluk hidup, dan Atmosfer yang menyelimuti udara di atas kita.';

export const SURFACE_TOUR_OUTRO =
  'Keren sekali! Keempat komponen permukaan Bumi—Litosfer, Hidrosfer, Biosfer, dan Atmosfer—selalu bekerja sama menjaga kehidupan. Kamu bisa menggeser slider Pisah Lapisan atau klik langsung objek 3D untuk mengamatinya lebih dekat!';

export const EARTH_LAYERS: EarthLayerInfo[] = [
  {
    id: 'kerak',
    name: 'Kerak Bumi',
    englishName: 'Crust',
    category: 'lapisan-dalam',
    categoryLabel: 'Lapisan Utama Bumi',
    accentHex: '#A16207',
    shortTagline: 'Lapisan paling luar dan paling tipis tempat kita tinggal.',
    thickness: '5 – 70 km',
    thicknessKmApprox: 35,
    percentOfRadius: 1.0,
    temperature: '0 – 400 °C',
    stateAndMaterial: 'Padat · Batuan & tanah',
    keyFunction: 'Tempat daratan, gunung, laut, dan makhluk hidup',
    summary:
      'Kerak Bumi adalah lapisan paling luar dari Bumi. Kita tinggal di atas kerak Bumi. Lapisan ini terdiri atas batuan dan menjadi tempat daratan, gunung, laut, dan berbagai makhluk hidup berada.',
    bulletPoints: [
      'Lapisan paling luar dari planet Bumi.',
      'Tempat manusia, hewan, dan tumbuhan hidup.',
      'Terdiri dari batuan, tanah, pegunungan, dan dasar laut.',
      'Kerak Bumi relatif sangat tipis dibandingkan lapisan lainnya.',
    ],
    funFact:
      'Jika Bumi sebesar buah apel, ketebalan Kerak Bumi kira-kira hanya setipis kulit apelnya!',
    astroDialogue:
      'Yuk, kita kenali lapisan paling luar Bumi! Lapisan inilah tempat kita tinggal bersama hewan dan tumbuhan.',
    narrationScript:
      'Kerak Bumi adalah lapisan paling luar dari Bumi. Kita tinggal di atas kerak Bumi. Lapisan ini terdiri atas batuan dan menjadi tempat daratan, gunung, laut, dan berbagai makhluk hidup berada. Dibandingkan lapisan di bawahnya, kerak Bumi sangatlah tipis, ibarat kulit tipis pada buah apel.',
    camera: {
      azimuth: 0.72,
      polar: 1.24,
      distance: 6.6,
      recommendedCutaway: 1.0,
    },
  },
  {
    id: 'mantel',
    name: 'Mantel Bumi',
    englishName: 'Mantle',
    category: 'lapisan-dalam',
    categoryLabel: 'Lapisan Utama Bumi',
    accentHex: '#EA580C',
    shortTagline: 'Lapisan paling tebal dari batuan sangat panas yang bergerak perlahan.',
    thickness: '± 2.900 km',
    thicknessKmApprox: 2900,
    percentOfRadius: 45.5,
    temperature: '1.000 – 3.700 °C',
    stateAndMaterial: 'Batuan sangat panas (semi-plastis)',
    keyFunction: 'Berhubungan dengan pergerakan lempeng Bumi',
    summary:
      'Mantel adalah lapisan yang sangat tebal di bawah kerak Bumi. Mantel tersusun dari batuan yang sangat panas. Dalam waktu yang sangat lama, material mantel dapat bergerak perlahan. Pergerakan ini berhubungan dengan pergerakan lempeng Bumi.',
    bulletPoints: [
      'Terletak tepat di bawah kerak Bumi.',
      'Merupakan lapisan yang paling tebal (hampir separuh jari-jari Bumi).',
      'Suhunya sangat tinggi dan tersusun dari batuan panas.',
      'Materialnya dapat bergerak perlahan dalam waktu yang sangat lama.',
    ],
    funFact:
      'Aliran material panas di mantel bergerak sangat pelan—hampir sama lambatnya dengan pertumbuhan kuku jarimu!',
    astroDialogue:
      'Wah, ternyata di bawah kerak ada lapisan yang sangat tebal bernama mantel! Material batuannya panas dan bergerak perlahan.',
    narrationScript:
      'Mantel adalah lapisan yang sangat tebal di bawah kerak Bumi. Mantel tersusun dari batuan yang sangat panas. Dalam waktu yang sangat lama, material mantel dapat bergerak perlahan membentuk arus melingkar. Pergerakan ini berhubungan erat dengan pergerakan lempeng di permukaan Bumi.',
    camera: {
      azimuth: 0.72,
      polar: 1.32,
      distance: 6.1,
      recommendedCutaway: 1.0,
    },
  },
  {
    id: 'inti-luar',
    name: 'Inti Luar',
    englishName: 'Outer Core',
    category: 'lapisan-dalam',
    categoryLabel: 'Lapisan Utama Bumi',
    accentHex: '#F59E0B',
    shortTagline: 'Lapisan besi dan nikel cair yang membentuk medan magnet Bumi.',
    thickness: '± 2.200 km',
    thicknessKmApprox: 2200,
    percentOfRadius: 34.5,
    temperature: '4.000 – 5.000 °C',
    stateAndMaterial: 'Cair · Logam besi & nikel',
    keyFunction: 'Membantu menghasilkan medan magnet pelindung Bumi',
    summary:
      'Inti luar Bumi merupakan lapisan yang tersusun terutama dari besi dan nikel dalam keadaan cair. Pergerakan logam cair di dalam inti luar membantu menghasilkan medan magnet Bumi.',
    bulletPoints: [
      'Berada di bawah mantel Bumi.',
      'Tersusun terutama dari logam besi dan nikel.',
      'Berwujud cair karena suhunya amat panas.',
      'Pergerakan logam cairnya berperan menghasilkan medan magnet Bumi.',
    ],
    funFact:
      'Medan magnet dari inti luar membuat jarum kompas selalu menunjuk arah utara-selatan dan melindungi Bumi dari angin matahari!',
    astroDialogue:
      'Di bagian ini terdapat logam cair yang bergerak perlahan. Gerakannya membantu Bumi memiliki medan magnet!',
    narrationScript:
      'Inti luar Bumi berada di bawah mantel dan tersusun terutama dari besi dan nikel dalam keadaan cair. Pergerakan logam cair di dalam inti luar membantu menghasilkan medan magnet Bumi yang melindungi planet kita dari radiasi luar angkasa.',
    camera: {
      azimuth: 0.72,
      polar: 1.38,
      distance: 5.7,
      recommendedCutaway: 1.0,
    },
  },
  {
    id: 'inti-dalam',
    name: 'Inti Dalam',
    englishName: 'Inner Core',
    category: 'lapisan-dalam',
    categoryLabel: 'Lapisan Utama Bumi',
    accentHex: '#FDE047',
    shortTagline: 'Pusat terdalam Bumi berupa bola logam padat bertekanan sangat besar.',
    thickness: 'Jari-jari ± 1.220 km',
    thicknessKmApprox: 1220,
    percentOfRadius: 19.0,
    temperature: '5.500 – 6.000 °C',
    stateAndMaterial: 'Padat · Bola logam besi & nikel',
    keyFunction: 'Pusat terdalam dan sumber panas utama Bumi',
    summary:
      'Inti dalam adalah bagian paling tengah dari Bumi. Inti dalam tersusun terutama dari besi dan nikel. Walaupun suhunya sangat tinggi, inti dalam berwujud padat karena tekanan yang sangat besar di bagian dalam Bumi.',
    bulletPoints: [
      'Bagian paling dalam dan paling tengah dari Bumi.',
      'Suhunya sangat tinggi, hampir sepanas permukaan Matahari.',
      'Tersusun terutama dari logam besi dan nikel.',
      'Tetap berwujud padat karena tekanan yang sangat besar.',
    ],
    funFact:
      'Ukuran bola padat Inti Dalam Bumi hampir sebesar ukuran Bulan di langit malam!',
    astroDialogue:
      'Ini dia bagian paling tengah Bumi! Walaupun sangat panas, bagian ini tetap padat karena tekanan yang sangat besar.',
    narrationScript:
      'Inti dalam adalah bagian paling tengah dari Bumi. Inti dalam tersusun terutama dari besi dan nikel. Walaupun suhunya sangat tinggi hingga enam ribu derajat Celsius, inti dalam tetap berwujud padat karena tekanan yang sangat besar dari seluruh lapisan Bumi di atasnya.',
    camera: {
      azimuth: 0.72,
      polar: 1.4,
      distance: 5.2,
      recommendedCutaway: 1.0,
    },
  },
  {
    id: 'litosfer',
    name: 'Litosfer',
    englishName: 'Lithosphere',
    category: 'komponen-bumi',
    categoryLabel: 'Komponen Permukaan Bumi',
    accentHex: '#D97706',
    shortTagline: 'Komponen daratan dan batuan pembentuk gunung, bukit, dan benua.',
    thickness: '± 100 km (Kerak + Mantel Atas)',
    thicknessKmApprox: 100,
    percentOfRadius: 1.6,
    temperature: '-20 – 400 °C',
    stateAndMaterial: 'Batuan keras, tanah & pegunungan',
    keyFunction: 'Tempat tinggal makhluk darat dan sumber mineral',
    summary:
      'Litosfer adalah bagian daratan dan lapisan batuan padat di permukaan Bumi yang membentuk benua, pulau, gunung, lembah, dan tanah subur.',
    bulletPoints: [
      'Menutupi sekitar 29% permukaan Bumi berupa pulau dan benua.',
      'Membentuk kenampakan daratan seperti gunung, bukit, dan dataran rendah.',
      'Menyediakan tanah subur tempat tumbuhan dan pertanian berkembang.',
    ],
    subLayers: [
      {
        name: 'Pegunungan & Dataran Tinggi',
        range: 'Daratan tinggi',
        detail: 'Bentang alam menjulang yang menjadi daerah hulu sungai dan cadangan salju.',
        accentHex: '#A8A29E',
      },
      {
        name: 'Lapisan Tanah Subur (Topsoil)',
        range: 'Permukaan tanah',
        detail: 'Lapisan paling atas kaya humus tempat akar tumbuhan dan pertanian tumbuh.',
        accentHex: '#92400E',
      },
      {
        name: 'Batuan Sedimen & Batuan Induk',
        range: 'Bawah permukaan',
        detail: 'Lapisan batuan berlapis dan batuan keras penyangga benua serta dasar samudra.',
        accentHex: '#57534E',
      },
    ],
    funFact:
      'Gunung Everest di Pegunungan Himalaya adalah puncak tertinggi di litosfer daratan dengan tinggi 8.848 meter!',
    astroDialogue:
      'Lihat pegunungan dan pulau-pulau di permukaan Bumi! Bagian daratan dan batuan ini disebut Litosfer.',
    narrationScript:
      'Litosfer adalah komponen daratan dan lapisan batuan di permukaan Bumi. Di sinilah terbentuk gunung, bukit, lembah, dataran rendah, hingga tanah tempat tumbuhan hidup dan manusia membangun rumah.',
    camera: {
      azimuth: -1.1,
      polar: 1.24,
      distance: 6.7,
      recommendedCutaway: 0.0,
    },
  },
  {
    id: 'hidrosfer',
    name: 'Hidrosfer',
    englishName: 'Hydrosphere',
    category: 'komponen-bumi',
    categoryLabel: 'Komponen Permukaan Bumi',
    accentHex: '#0284C7',
    shortTagline: 'Komponen perairan yang menutupi sekitar 71% permukaan Bumi.',
    thickness: 'Rata-rata laut 3,7 km',
    thicknessKmApprox: 4,
    percentOfRadius: 0.1,
    temperature: '-2 – 35 °C',
    stateAndMaterial: 'Air laut, air tawar, es kutub & uap air',
    keyFunction: 'Menjaga iklim dan sumber air bagi seluruh makhluk hidup',
    summary:
      'Hidrosfer adalah seluruh wilayah perairan di Bumi meliputi samudra, laut, sungai, danau, air tanah, dan es kutub. Air terus berputar melalui siklus air.',
    bulletPoints: [
      'Menutupi sekitar 71% permukaan Bumi sehingga Bumi disebut Planet Biru.',
      'Bergerak terus-menerus dalam siklus air: penguapan, pengembunan, dan hujan.',
      'Sebagian besar air adalah air laut asin, sehingga air tawar harus selalu dihemat.',
    ],
    subLayers: [
      {
        name: 'Perairan Laut & Samudra',
        range: '± 97% air Bumi',
        detail: 'Wilayah air asin luas yang mengatur suhu planet dan menjadi rumah biota laut.',
        accentHex: '#0284C7',
      },
      {
        name: 'Perairan Darat (Sungai & Danau)',
        range: 'Air tawar permukaan',
        detail: 'Air yang mengalir dari pegunungan ke laut, sumber minum dan irigasi.',
        accentHex: '#38BDF8',
      },
      {
        name: 'Siklus Air (Evaporasi & Hujan)',
        range: 'Berputar terus',
        detail: 'Air laut menguap menjadi awan lalu turun sebagai hujan yang menyegarkan daratan.',
        accentHex: '#7DD3FC',
      },
    ],
    funFact:
      'Palung Mariana di Samudra Pasifik kedalamannya hampir 11 kilometer—lebih dalam dari tinggi Gunung Everest!',
    astroDialogue:
      'Bumi kita terlihat biru indah dari angkasa karena 71 persen permukaannya tertutup perairan Hidrosfer!',
    narrationScript:
      'Hidrosfer mencakup seluruh perairan di Bumi, mulai dari samudra luas, sungai, danau, air tanah, hingga es di kutub. Karena perairan menutupi 71 persen permukaannya, Bumi dijuluki Planet Biru.',
    camera: {
      azimuth: -2.15,
      polar: 1.46,
      distance: 6.8,
      recommendedCutaway: 0.0,
    },
  },
  {
    id: 'atmosfer',
    name: 'Atmosfer',
    englishName: 'Atmosphere',
    category: 'komponen-bumi',
    categoryLabel: 'Komponen Permukaan Bumi',
    accentHex: '#38BDF8',
    shortTagline: 'Selimut lapisan udara tipis yang melindungi Bumi dan menyediakan oksigen.',
    thickness: '0 – ± 1.000 km ke angkasa',
    thicknessKmApprox: 1000,
    percentOfRadius: 15.0,
    temperature: '-90 – 1.500 °C',
    stateAndMaterial: 'Gas · 78% Nitrogen, 21% Oksigen',
    keyFunction: 'Menyediakan oksigen, mengatur cuaca, dan menahan meteor',
    summary:
      'Atmosfer adalah lapisan udara yang menyelimuti Bumi. Di lapisan ini terjadi awan dan hujan (Troposfer), ada lapisan Ozon pelindung sinar UV (Stratosfer), serta pembakaran meteor (Mesosfer).',
    bulletPoints: [
      'Menyediakan udara dan oksigen agar makhluk hidup bisa bernapas.',
      'Melindungi Bumi dari radiasi ultraviolet berbahaya melalui lapisan Ozon.',
      'Membakar sebagian besar meteor sebelum jatuh ke permukaan Bumi.',
    ],
    subLayers: [
      {
        id: 'troposfer',
        name: 'Troposfer',
        range: '0 – 12 km',
        short3dHint: 'Awan & hujan',
        detail: 'Lapisan terbawah tempat awan, angin, petir, dan hujan terjadi setiap hari.',
        narration:
          'Troposfer adalah lapisan atmosfer paling bawah yang paling dekat dengan permukaan Bumi, mulai dari 0 hingga 12 kilometer. Di sinilah kita bernapas dan terjadi semua peristiwa cuaca seperti awan, angin, petir, dan hujan!',
        accentHex: '#7DD3FC',
      },
      {
        id: 'stratosfer',
        name: 'Stratosfer & Ozon',
        range: '12 – 50 km',
        short3dHint: 'Ozon UV & pesawat',
        detail: 'Jalur terbang pesawat jet sekaligus rumah lapisan Ozon pelindung sinar UV.',
        narration:
          'Stratosfer berada di ketinggian 12 hingga 50 kilometer dengan udara yang tenang sehingga aman untuk jalur terbang pesawat jet. Di lapisan ini terdapat Lapisan Ozon yang melindungi Bumi dari sinar ultraviolet berbahaya Matahari!',
        accentHex: '#22D3EE',
      },
      {
        id: 'mesosfer',
        name: 'Mesosfer',
        range: '50 – 85 km',
        short3dHint: 'Membakar meteor',
        detail: 'Lapisan dingin yang membakar meteor agar tidak jatuh menabrak permukaan Bumi.',
        narration:
          'Mesosfer berada di ketinggian 50 hingga 85 kilometer dan merupakan lapisan atmosfer yang sangat dingin. Lapisan ini menjadi perisai pelindung yang membakar meteor dari luar angkasa sebelum jatuh menabrak permukaan Bumi!',
        accentHex: '#818CF8',
      },
      {
        id: 'termosfer',
        name: 'Termosfer & Eksosfer',
        range: '> 85 km',
        short3dHint: 'Aurora & satelit',
        detail: 'Lapisan teratas tempat terjadinya aurora dan lintasan orbit satelit komunikasi.',
        narration:
          'Termosfer dan Eksosfer adalah lapisan atmosfer teratas yang berbatasan langsung dengan ruang angkasa. Di lapisan ini muncul cahaya aurora yang indah serta menjadi lintasan orbit satelit komunikasi dan cuaca!',
        accentHex: '#38BDF8',
      },
    ],
    funFact:
      'Cahaya biru tipis di tepi bola Bumi 3D dan awan putih yang bergerak adalah bagian dari lapisan Atmosfer!',
    astroDialogue:
      'Perhatikan selimut cahaya biru tipis, awan, dan satelit di sekeliling Bumi! Itulah Atmosfer pelindung kita.',
    narrationScript:
      'Atmosfer adalah lapisan udara yang menyelimuti planet Bumi. Atmosfer menyediakan oksigen untuk bernapas, mengatur cuaca dan hujan, serta melindungi kita dari sinar ultraviolet Matahari dan meteor luar angkasa.',
    camera: {
      azimuth: 2.3,
      polar: 1.12,
      distance: 8.0,
      recommendedCutaway: 0.0,
    },
  },
  {
    id: 'biosfer',
    name: 'Biosfer',
    englishName: 'Biosphere',
    category: 'komponen-bumi',
    categoryLabel: 'Komponen Permukaan Bumi',
    accentHex: '#10B981',
    shortTagline: 'Ruang tempat tumbuhan, hewan, dan manusia hidup saling berdampingan.',
    thickness: '± 20 km (dasar laut – puncak gunung)',
    thicknessKmApprox: 20,
    percentOfRadius: 0.3,
    temperature: '-40 – 50 °C',
    stateAndMaterial: 'Hutan, ekosistem darat & ekosistem laut',
    keyFunction: 'Menjaga oksigen hutan dan keseimbangan jaring kehidupan',
    summary:
      'Biosfer adalah seluruh ruang kehidupan di darat, air, dan udara rendah tempat manusia, hewan, dan tumbuhan tinggal serta saling bergantung.',
    bulletPoints: [
      'Menghubungkan daratan (Litosfer), air (Hidrosfer), dan udara (Atmosfer).',
      'Hutan hijau menghasilkan oksigen segar untuk pernapasan makhluk hidup.',
      'Merawat tanaman dan tidak membuang sampah sembarangan menjaga kelestarian biosfer.',
    ],
    subLayers: [
      {
        name: 'Ekosistem Darat (Hutan & Padang)',
        range: 'Di atas Litosfer',
        detail: 'Pepohonan hijau menghasilkan oksigen dan menjadi habitat satwa darat.',
        accentHex: '#10B981',
      },
      {
        name: 'Ekosistem Perairan (Laut & Sungai)',
        range: 'Di dalam Hidrosfer',
        detail: 'Tempat hidup ikan, terumbu karang, dan tumbuhan air yang menjaga rantai makanan.',
        accentHex: '#06B6D4',
      },
      {
        name: 'Ruang Udara Rendah & Permukiman',
        range: 'Lapisan bawah Troposfer',
        detail: 'Tempat burung terbang serta manusia hidup dan menjaga kelestarian alam.',
        accentHex: '#F59E0B',
      },
    ],
    funFact:
      'Bumi adalah satu-satunya planet yang diketahui hingga kini memiliki biosfer kaya kehidupan!',
    astroDialogue:
      'Lihat hutan hijau di atas benua! Di ruang kehidupan Biosfer inilah tumbuhan, hewan, dan manusia tinggal bersama.',
    narrationScript:
      'Biosfer adalah lapisan kehidupan tempat manusia, hewan, dan tumbuhan tinggal bersama. Hutan menghasilkan oksigen bersih dan menjadi rumah satwa. Mari kita selalu menjaga kelestarian alam Bumi!',
    camera: {
      azimuth: -0.4,
      polar: 1.18,
      distance: 6.4,
      recommendedCutaway: 0.0,
    },
  },
];

export const MAIN_INTERNAL_LAYERS = EARTH_LAYERS.filter(
  (l) => l.category === 'lapisan-dalam',
);

export const LAYER_MAP: Record<LayerId, EarthLayerInfo> = EARTH_LAYERS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<LayerId, EarthLayerInfo>,
);

export const ATMOSFER_SUB_LAYERS = (LAYER_MAP.atmosfer.subLayers ?? []).filter(
  (s): s is SurfaceSubLayer & { id: AtmosSubLayerId } => Boolean(s.id),
);

export const ATMOSFER_SUB_MAP: Record<
  AtmosSubLayerId,
  SurfaceSubLayer & { id: AtmosSubLayerId }
> = ATMOSFER_SUB_LAYERS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<AtmosSubLayerId, SurfaceSubLayer & { id: AtmosSubLayerId }>,
);

export const ATMOSFER_TOUR_INTRO =
  'Ayo kita terbang menembus langit untuk mengenal lapisan-lapisan atmosfer Bumi! Atmosfer tersusun bertingkat mulai dari bawah hingga mendekati ruang angkasa, yaitu Troposfer, Stratosfer, Mesosfer, serta Termosfer dan Eksosfer. Mari kita jelajahi satu per satu!';

export const ATMOSFER_TOUR_OUTRO =
  'Luar biasa! Kamu sudah mengenal semua lapisan atmosfer dari Troposfer tempat awan dan hujan hingga Termosfer tempat aurora dan satelit. Sekarang klik langsung lapisan mana saja di visual 3D untuk mengamatinya lebih dekat!';

export const FULL_NARRATION_INTRO =
  'Hallo, penjelajah kelas 5 SD! Selamat datang di Berkenalan dengan Bumi Kita. Tahukah kamu bahwa Bumi yang kita tinggali memiliki empat lapisan utama di dalamnya—yaitu Kerak Bumi, Mantel Bumi, Inti Luar, dan Inti Dalam—serta komponen permukaan berupa Litosfer, Hidrosfer, Atmosfer, dan Biosfer? Yuk kita jelajahi bersama!';

export const FULL_NARRATION_OUTRO =
  'Hebat sekali, penjelajah! Kamu sudah mengenal struktur lapisan dan komponen Bumi kita. Sekarang, ayo uji pemahamanmu dengan mengerjakan kuis interaktif dan kumpulkan bintang sebanyak-banyaknya!';

export function buildFullNarrationScript(): string {
  const sections = [
    `[PEMBUKAAN]\n${FULL_NARRATION_INTRO}`,
    ...EARTH_LAYERS.map(
      (layer, idx) =>
        `[${idx + 1}. ${layer.name.toUpperCase()}]\n${layer.narrationScript}`,
    ),
    `[PENUTUP]\n${FULL_NARRATION_OUTRO}`,
  ];
  return sections.join('\n\n');
}
