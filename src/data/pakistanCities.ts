export interface PakistanCity {
  id: string;
  name: string;
  urduName: string;
  province: 'Punjab' | 'Sindh' | 'KPK' | 'Balochistan' | 'Islamabad' | 'Gilgit-Baltistan' | 'AJK';
  lat: number;
  lon: number;
  popular?: boolean;
}

export const PAKISTAN_CITIES: PakistanCity[] = [
  // Popular / Major
  { id: 'sadiqabad', name: 'Sadiqabad', urduName: 'صادق آباد', province: 'Punjab', lat: 28.3006, lon: 70.1302, popular: true },
  { id: 'rahim_yar_khan', name: 'Rahim Yar Khan', urduName: 'رحیم یار خان', province: 'Punjab', lat: 28.4212, lon: 70.2989, popular: true },
  { id: 'lahore', name: 'Lahore', urduName: 'لاہور', province: 'Punjab', lat: 31.5204, lon: 74.3587, popular: true },
  { id: 'karachi', name: 'Karachi', urduName: 'کراچی', province: 'Sindh', lat: 24.8607, lon: 67.0011, popular: true },
  { id: 'islamabad', name: 'Islamabad', urduName: 'اسلام آباد', province: 'Islamabad', lat: 33.6844, lon: 73.0479, popular: true },
  { id: 'rawalpindi', name: 'Rawalpindi', urduName: 'راولپنڈی', province: 'Punjab', lat: 33.5651, lon: 73.0169, popular: true },
  { id: 'faisalabad', name: 'Faisalabad', urduName: 'فیصل آباد', province: 'Punjab', lat: 31.4504, lon: 73.1350, popular: true },
  { id: 'multan', name: 'Multan', urduName: 'ملتان', province: 'Punjab', lat: 30.1575, lon: 71.5249, popular: true },
  { id: 'peshawar', name: 'Peshawar', urduName: 'پشاور', province: 'KPK', lat: 34.0151, lon: 71.5249, popular: true },
  { id: 'quetta', name: 'Quetta', urduName: 'کوئٹہ', province: 'Balochistan', lat: 30.1798, lon: 66.9750, popular: true },
  { id: 'gujranwala', name: 'Gujranwala', urduName: 'گجرانوالہ', province: 'Punjab', lat: 32.1877, lon: 74.1945, popular: true },
  { id: 'sialkot', name: 'Sialkot', urduName: 'سیالکوٹ', province: 'Punjab', lat: 32.4945, lon: 74.5229, popular: true },
  { id: 'hyderabad', name: 'Hyderabad', urduName: 'حیدرآباد', province: 'Sindh', lat: 25.3960, lon: 68.3578, popular: true },
  { id: 'bahawalpur', name: 'Bahawalpur', urduName: 'بہاولپور', province: 'Punjab', lat: 29.3544, lon: 71.6911, popular: true },
  { id: 'sargodha', name: 'Sargodha', urduName: 'سرگودھا', province: 'Punjab', lat: 32.0836, lon: 72.6711 },
  { id: 'sukkur', name: 'Sukkur', urduName: 'سکھر', province: 'Sindh', lat: 27.7131, lon: 68.8486 },
  { id: 'larkana', name: 'Larkana', urduName: 'لاڑکانہ', province: 'Sindh', lat: 27.5570, lon: 68.2028 },
  { id: 'sheikhupura', name: 'Sheikhupura', urduName: 'شیخوپورہ', province: 'Punjab', lat: 31.7167, lon: 73.9850 },
  { id: 'jhang', name: 'Jhang', urduName: 'جھنگ', province: 'Punjab', lat: 31.2681, lon: 72.3181 },
  { id: 'gujrat', name: 'Gujrat', urduName: 'گجرات', province: 'Punjab', lat: 32.5742, lon: 74.0754 },
  { id: 'mardan', name: 'Mardan', urduName: 'مردان', province: 'KPK', lat: 34.1986, lon: 72.0404 },
  { id: 'kasur', name: 'Kasur', urduName: 'قصور', province: 'Punjab', lat: 31.1156, lon: 74.4503 },
  { id: 'dera_ghazi_khan', name: 'Dera Ghazi Khan', urduName: 'ڈیرہ غازی خان', province: 'Punjab', lat: 30.0561, lon: 70.6348 },
  { id: 'sahiwal', name: 'Sahiwal', urduName: 'ساہیوال', province: 'Punjab', lat: 30.6682, lon: 73.1114 },
  { id: 'mirpur_khas', name: 'Mirpur Khas', urduName: 'میرپور خاص', province: 'Sindh', lat: 25.5276, lon: 69.0125 },
  { id: 'okara', name: 'Okara', urduName: 'اوکاڑہ', province: 'Punjab', lat: 30.8100, lon: 73.4597 },
  { id: 'abbottabad', name: 'Abbottabad', urduName: 'ایبٹ آباد', province: 'KPK', lat: 34.1688, lon: 73.2215 },
  { id: 'muzaffarabad', name: 'Muzaffarabad', urduName: 'مظفرآباد', province: 'AJK', lat: 34.3700, lon: 73.4711 },
  { id: 'gwadar', name: 'Gwadar', urduName: 'گوادر', province: 'Balochistan', lat: 25.1216, lon: 62.3254 },
  { id: 'gilgit', name: 'Gilgit', urduName: 'گلگت', province: 'Gilgit-Baltistan', lat: 35.9208, lon: 74.3089 },
  { id: 'skardu', name: 'Skardu', urduName: 'سکردو', province: 'Gilgit-Baltistan', lat: 35.2971, lon: 75.6333 },
  { id: 'chitral', name: 'Chitral', urduName: 'چترال', province: 'KPK', lat: 35.8510, lon: 71.7863 },
  { id: 'dera_ismail_khan', name: 'Dera Ismail Khan', urduName: 'ڈیرہ اسماعیل خان', province: 'KPK', lat: 31.8312, lon: 70.9017 },
  { id: 'khuzdar', name: 'Khuzdar', urduName: 'خضدار', province: 'Balochistan', lat: 27.8164, lon: 66.6057 },
  { id: 'chiniot', name: 'Chiniot', urduName: 'چنیوٹ', province: 'Punjab', lat: 31.7200, lon: 72.9789 },
  { id: 'zhob', name: 'Zhob', urduName: 'ژوب', province: 'Balochistan', lat: 31.3417, lon: 69.4486 },
  { id: 'khanewal', name: 'Khanewal', urduName: 'خانیوال', province: 'Punjab', lat: 30.3017, lon: 71.9321 },
  { id: 'hafizabad', name: 'Hafizabad', urduName: 'حافظ آباد', province: 'Punjab', lat: 32.0679, lon: 73.6854 },
  { id: 'mandi_bahauddin', name: 'Mandi Bahauddin', urduName: 'منڈی بہاؤالدین', province: 'Punjab', lat: 32.5870, lon: 73.4912 },
  { id: 'vehari', name: 'Vehari', urduName: 'وہاڑی', province: 'Punjab', lat: 30.0419, lon: 72.3528 },
  { id: 'attock', name: 'Attock', urduName: 'اٹک', province: 'Punjab', lat: 33.7660, lon: 72.3590 },
  { id: 'nawabshah', name: 'Nawabshah', urduName: 'نواب شاہ', province: 'Sindh', lat: 26.2483, lon: 68.4096 },
  { id: 'turbat', name: 'Turbat', urduName: 'تربت', province: 'Balochistan', lat: 26.0023, lon: 63.0440 },
  { id: 'hunza', name: 'Hunza', urduName: 'ہنزہ', province: 'Gilgit-Baltistan', lat: 36.3167, lon: 74.6500 },
  { id: 'swat', name: 'Swat / Mingora', urduName: 'سوات', province: 'KPK', lat: 34.7717, lon: 72.3602 }
];
