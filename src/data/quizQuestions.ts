import type { LayerId } from './earthContent';

export interface QuizQuestion {
  id: number;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  relatedLayerId: LayerId;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    topic: 'Kerak Bumi',
    question: 'Lapisan Bumi paling luar yang menjadi tempat kita tinggal adalah ....',
    options: ['Mantel Bumi', 'Kerak Bumi', 'Inti Dalam', 'Inti Luar'],
    correctIndex: 1,
    explanation:
      'Kerak Bumi adalah lapisan paling luar dari Bumi yang terdiri atas batuan dan menjadi tempat daratan, gunung, laut, serta makhluk hidup berada.',
    relatedLayerId: 'kerak',
  },
  {
    id: 2,
    topic: 'Mantel Bumi',
    question: 'Lapisan struktur dalam Bumi yang paling tebal adalah ....',
    options: ['Kerak Bumi', 'Mantel Bumi', 'Inti Dalam', 'Atmosfer'],
    correctIndex: 1,
    explanation:
      'Mantel Bumi adalah lapisan paling tebal di bawah kerak (sekitar 2.900 km) yang tersusun atas batuan sangat panas dan bergerak perlahan.',
    relatedLayerId: 'mantel',
  },
  {
    id: 3,
    topic: 'Inti Luar',
    question: 'Inti luar Bumi yang tersusun dari besi dan nikel berwujud ....',
    options: ['Padat', 'Cair', 'Gas', 'Es'],
    correctIndex: 1,
    explanation:
      'Inti luar berwujud cair karena suhunya sangat tinggi (4.000–5.000 °C). Pergerakan logam cair inilah yang membantu menghasilkan medan magnet Bumi.',
    relatedLayerId: 'inti-luar',
  },
  {
    id: 4,
    topic: 'Inti Dalam',
    question: 'Bagian paling tengah dan paling dalam dari planet Bumi adalah ....',
    options: ['Mantel Bumi', 'Kerak Bumi', 'Inti Dalam', 'Litosfer'],
    correctIndex: 2,
    explanation:
      'Inti dalam berada tepat di pusat planet Bumi berupa bola logam padat besi dan nikel bersuhu sangat tinggi.',
    relatedLayerId: 'inti-dalam',
  },
  {
    id: 5,
    topic: 'Tekanan Inti Dalam',
    question: 'Mengapa inti dalam Bumi tetap berwujud padat meskipun suhunya sangat panas?',
    options: [
      'Karena suhunya sangat dingin',
      'Karena tekanan yang sangat besar di bagian dalam Bumi',
      'Karena berada dekat dengan awan atmosfer',
      'Karena tersusun dari air laut beku',
    ],
    correctIndex: 1,
    explanation:
      'Walaupun sangat panas (hingga ~6.000 °C), tekanan sangat besar dari seluruh lapisan Bumi di atasnya membuat besi dan nikel di inti dalam tetap padat.',
    relatedLayerId: 'inti-dalam',
  },
  {
    id: 6,
    topic: 'Urutan Lapisan Bumi',
    question:
      'Urutan empat lapisan utama Bumi dari yang paling luar menuju bagian paling tengah adalah ....',
    options: [
      'Kerak Bumi – Mantel Bumi – Inti Luar – Inti Dalam',
      'Mantel Bumi – Kerak Bumi – Inti Luar – Inti Dalam',
      'Kerak Bumi – Inti Luar – Mantel Bumi – Inti Dalam',
      'Inti Dalam – Inti Luar – Mantel Bumi – Kerak Bumi',
    ],
    correctIndex: 0,
    explanation:
      'Dari luar ke dalam, urutannya selalu: Kerak Bumi (tertipis), Mantel Bumi (tertebal), Inti Luar (cair), lalu Inti Dalam (padat).',
    relatedLayerId: 'kerak',
  },
  {
    id: 7,
    topic: 'Medan Magnet Bumi',
    question:
      'Pergerakan logam besi dan nikel cair di dalam Inti Luar sangat bermanfaat bagi Bumi karena ....',
    options: [
      'Membuat hujan turun setiap hari',
      'Membantu menghasilkan medan magnet pelindung Bumi',
      'Mengubah batuan menjadi tanah liat',
      'Mendinginkan permukaan gunung berapi',
    ],
    correctIndex: 1,
    explanation:
      'Aliran logam cair yang bergerak di Inti Luar membentuk medan magnet Bumi yang melindungi kita dari radiasi berbahaya dan membantu kompas bekerja.',
    relatedLayerId: 'inti-luar',
  },
  {
    id: 8,
    topic: 'Pergerakan Mantel',
    question:
      'Pergerakan material panas yang sangat perlahan di dalam Mantel Bumi berhubungan dengan ....',
    options: [
      'Pergerakan lempeng Bumi di atasnya',
      'Terbentuknya pelangi di langit',
      'Berubahnya arah tiupan angin laut',
      'Pasang surut air sungai kecil',
    ],
    correctIndex: 0,
    explanation:
      'Dalam waktu yang sangat lama, aliran panas perlahan di Mantel Bumi mendorong pergerakan lempeng-lempeng Kerak Bumi.',
    relatedLayerId: 'mantel',
  },
  {
    id: 9,
    topic: 'Ketebalan Kerak Bumi',
    question:
      'Jika dibandingkan dengan Mantel dan Inti Bumi, ketebalan Kerak Bumi adalah ....',
    options: [
      'Paling tebal dari semua lapisan',
      'Sama tebalnya dengan Mantel Bumi',
      'Paling tipis, ibarat kulit pada buah apel',
      'Lebih tebal dari Inti Luar',
    ],
    correctIndex: 2,
    explanation:
      'Kerak Bumi hanya setebal sekitar 5–70 km atau sekitar 1% dari jari-jari Bumi, sehingga menjadi lapisan paling tipis.',
    relatedLayerId: 'kerak',
  },
  {
    id: 10,
    topic: 'Komponen Litosfer',
    question:
      'Gunung, pegunungan, bukit, lembah, dan daratan benua termasuk komponen Bumi yang disebut ....',
    options: ['Hidrosfer', 'Atmosfer', 'Litosfer', 'Inti Luar'],
    correctIndex: 2,
    explanation:
      'Litosfer berasal dari kata "lithos" (batuan) yang mencakup seluruh daratan dan lapisan batuan padat permukaan Bumi.',
    relatedLayerId: 'litosfer',
  },
  {
    id: 11,
    topic: 'Komponen Hidrosfer',
    question:
      'Bumi dijuluki "Planet Biru" karena sekitar 71% permukaannya ditutupi oleh perairan yang disebut ....',
    options: ['Litosfer', 'Hidrosfer', 'Biosfer', 'Mantel Bumi'],
    correctIndex: 1,
    explanation:
      'Hidrosfer mencakup seluruh air di Bumi seperti samudra, laut, sungai, danau, es kutub, dan air tanah.',
    relatedLayerId: 'hidrosfer',
  },
  {
    id: 12,
    topic: 'Siklus Air',
    question:
      'Proses berubahnya air laut atau sungai menjadi uap air karena panas Matahari disebut ....',
    options: ['Kondensasi', 'Presipitasi', 'Evaporasi', 'Infiltrasi'],
    correctIndex: 2,
    explanation:
      'Evaporasi adalah penguapan air dari permukaan Bumi ke atmosfer sebelum mengembun (kondensasi) dan turun menjadi hujan (presipitasi).',
    relatedLayerId: 'hidrosfer',
  },
  {
    id: 13,
    topic: 'Komponen Atmosfer',
    question:
      'Lapisan udara tipis yang menyelimuti Bumi, tempat terjadinya cuaca dan awan serta pelindung dari meteor adalah ....',
    options: ['Atmosfer', 'Kerak Samudra', 'Inti Dalam', 'Litosfer'],
    correctIndex: 0,
    explanation:
      'Atmosfer adalah selimut gas pelindung Bumi yang menyediakan oksigen, mengatur cuaca di troposfer, dan membakar meteor di mesosfer.',
    relatedLayerId: 'atmosfer',
  },
  {
    id: 14,
    topic: 'Komponen Biosfer',
    question:
      'Ruang kehidupan di darat, perairan, dan udara rendah tempat tumbuhan, hewan, dan manusia hidup bersama disebut ....',
    options: ['Biosfer', 'Mantel Bumi', 'Inti Luar', 'Litosfer'],
    correctIndex: 0,
    explanation:
      'Biosfer ("bio" = hidup) adalah ruang ekosistem tempat seluruh makhluk hidup tinggal dan saling berinteraksi.',
    relatedLayerId: 'biosfer',
  },
  {
    id: 15,
    topic: 'Menjaga Bumi Kita',
    question:
      'Sikap nyata siswa kelas 5 SD untuk ikut menjaga kelestarian planet Bumi adalah ....',
    options: [
      'Membuang sampah plastik ke sungai agar cepat hilang',
      'Menghemat air bersih, menanam pohon, dan membuang sampah pada tempatnya',
      'Membiarkan lampu dan keran air menyala sepanjang hari',
      'Menebang seluruh pohon rindang di halaman sekolah',
    ],
    correctIndex: 1,
    explanation:
      'Menghemat air, menanam pohon, dan menjaga kebersihan sungai ikut merawat Hidrosfer, Atmosfer, dan Biosfer Bumi kita.',
    relatedLayerId: 'biosfer',
  },
];
