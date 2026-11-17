import type {
  ActivityCategory,
  ActivityPlace,
  ActivityPlanItem,
  WishlistItem,
} from '@/types/activity';

export const MOCK_CATEGORIES: ActivityCategory[] = [
  {
    id: 'walking',
    name: 'เดินเล่น',
    icon: '🚶',
    bgColor: 'bg-[#E1E8F8]',
    textColor: 'text-[#385289]',
    accentColor: '#385289',
    itemCount: 3,
  },
  {
    id: 'garden',
    name: 'สวน ต้นไม้',
    icon: '🌱',
    bgColor: 'bg-[#E2F5E9]',
    textColor: 'text-[#2D6A4F]',
    accentColor: '#2D6A4F',
    itemCount: 4,
  },
  {
    id: 'temple',
    name: 'วัด ทำบุญ',
    icon: '🛕',
    bgColor: 'bg-[#FBEFD8]',
    textColor: 'text-[#7A4E00]',
    accentColor: '#7A4E00',
    itemCount: 2,
  },
  {
    id: 'club',
    name: 'ชมรม เพื่อน',
    icon: '👥',
    bgColor: 'bg-[#FDE5F0]',
    textColor: 'text-[#B4225A]',
    accentColor: '#B4225A',
    itemCount: 3,
  },
  {
    id: 'cooking',
    name: 'ทำอาหาร',
    icon: '🍲',
    bgColor: 'bg-[#FEEAE6]',
    textColor: 'text-[#A43828]',
    accentColor: '#A43828',
    itemCount: 2,
  },
  {
    id: 'learning',
    name: 'เรียนรู้',
    icon: '📖',
    bgColor: 'bg-[#EEE1FA]',
    textColor: 'text-[#544378]',
    accentColor: '#544378',
    itemCount: 3,
  },
];

export const MOCK_HERO_RECOMMENDATION = {
  badge: 'เหมาะกับวันนี้',
  title: 'เดินเล่นที่สวนชุมชนร่มไทร',
  timeText: '16:30 น.',
  distanceText: '600 ม.',
  walkTimeText: 'เดิน 10 นาที',
  reasonQuote: 'กำลังมีลมเย็นๆ ลุงชอบเดินตอนเย็น และเป็นทางเรียบ',
  placeId: 'rom-sai',
};

export const MOCK_PLACES: Record<string, ActivityPlace> = {
  'rom-sai': {
    id: 'rom-sai',
    name: 'สวนชุมชนร่มไทร',
    categoryId: 'walking',
    categoryName: 'เดินเล่น',
    tag: 'สวน • ราชการ',
    imageUrl: '/images/activities/park.png',
    heroImageUrl: '/images/activities/detail_hero.png',
    distanceText: '600 ม.',
    distanceMeters: 600,
    walkTimeText: 'เดิน 10 นาที',
    isOpen: true,
    statusText: 'เปิดอยู่ ถึง 20:00 น.',
    priceText: 'ฟรี ค่าใช้จ่าย',
    terrainText: 'เบา ทางเรียบ',
    matchingReason: 'ตรงกับที่ชอบ: เดินเล่นตอนเย็น',
    isWishlisted: false,
    whyRecommended: {
      title: 'ทำไมถึงแนะนำ',
      body: 'คุณชอบเดินตอนเย็น ที่นี่ใกล้บ้าน ทางเรียบ และมีม้านั่งพักระหว่างทางค่ะ',
      historyNote: 'ครั้งก่อน (15 พ.ค.) คุณบอกว่า "สนุกดี"',
    },
    activities: [
      {
        title: 'รำไม้พลอง มีครูสอน',
        schedule: 'ทุกวัน 17:00 น.',
      },
      {
        title: 'เดินรอบสระ',
        schedule: '600 ม. ต่อรอบ',
      },
    ],
    facilities: ['ทางเรียบ', 'มีม้านั่ง', 'มีห้องน้ำ', 'มีร่มเงา'],
    disclaimer: 'ข้อมูลอัปเดต [วันที่ตรวจเช็ค] • ถ้าไปแล้วมีอะไรเปลี่ยน ช่วยบอกหนูด้วยนะคะ',
    navigation: {
      distanceText: '600 ม.',
      walkTimeText: 'เดินราว 10 นาที',
    },
    nearbyPlaces: [
      {
        id: 'cafe-near-park',
        name: 'ร้านกาแฟข้างสวน',
        description: 'ใกล้ที่นี่ 150 ม. • แวะพักก่อนเดิน',
        icon: '☕',
      },
      {
        id: 'herbal-garden',
        name: 'สวนสมุนไพรชุมชน',
        description: 'คล้ายกัน • 1.5 กม.',
        icon: '🌱',
      },
    ],
  },
  'wat-samakkhi': {
    id: 'wat-samakkhi',
    name: 'ลานเดินรอบสระ วัดสามัคคีธรรม',
    categoryId: 'walking',
    categoryName: 'เดินเล่น',
    tag: 'วัด',
    imageUrl: '/images/activities/temple.png',
    heroImageUrl: '/images/activities/temple.png',
    distanceText: '1.2 กม.',
    distanceMeters: 1200,
    walkTimeText: 'เดิน 18 นาที',
    isOpen: true,
    statusText: 'เปิดอยู่ ถึง 19:00 น.',
    priceText: 'ฟรี ค่าใช้จ่าย',
    terrainText: 'เบา ทางเรียบ',
    matchingReason: 'ตรงกับที่ชอบ: เดินเล่น ไปวัด',
    isWishlisted: false,
    whyRecommended: {
      title: 'ทำไมถึงแนะนำ',
      body: 'วัดเงียบสงบ ลมพัดเย็นสบาย ลานกว้างและมีทางเดินรอบสระน้ำขนาดใหญ่ค่ะ',
      historyNote: 'คุณเคยบอกว่าอยากไปไหว้พระช่วงเย็น',
    },
    activities: [
      {
        title: 'ไหว้พระประธาน',
        schedule: 'เปิดตลอดวัน',
      },
      {
        title: 'เดินจงกรมรอบสระ',
        schedule: 'ร่มรื่นใต้เงาไม้',
      },
    ],
    facilities: ['ทางเรียบ', 'มีม้านั่ง', 'มีห้องน้ำ', 'มีร่มเงา'],
    disclaimer: 'ข้อมูลอัปเดต [วันที่ตรวจเช็ค]',
    navigation: {
      distanceText: '1.2 กม.',
      walkTimeText: 'เดินราว 18 นาที',
    },
    nearbyPlaces: [
      {
        id: 'morning-market',
        name: 'ตลาดเช้าชุมชน',
        description: 'ใกล้ที่นี่ 400 ม.',
        icon: '🍜',
      },
    ],
  },
  'herbal-garden': {
    id: 'herbal-garden',
    name: 'สวนสมุนไพรชุมชน',
    categoryId: 'walking',
    categoryName: 'เดินเล่น',
    tag: 'สวน',
    imageUrl: '/images/activities/garden.png',
    heroImageUrl: '/images/activities/garden.png',
    distanceText: '1.5 กม.',
    distanceMeters: 1500,
    walkTimeText: 'เดิน 22 นาที',
    isOpen: true,
    statusText: 'เปิดอยู่ ถึง 18:00 น.',
    priceText: 'ฟรี ค่าใช้จ่าย',
    terrainText: 'เบา ทางเรียบ',
    matchingReason: 'ตรงกับที่ชอบ: สวน ต้นไม้ เดินเล่น',
    isWishlisted: false,
    whyRecommended: {
      title: 'ทำไมถึงแนะนำ',
      body: 'แปลงสมุนไพรและต้นไม้นานาพันธุ์ มีกลิ่นหอมสมุนไพรและทางเดินชมแปลงปลูกค่ะ',
    },
    activities: [
      {
        title: 'ชมแปลงสมุนไพรพื้นบ้าน',
        schedule: 'เปิดทุกวัน',
      },
      {
        title: 'เวิร์กช็อปชงชาสมุนไพร',
        schedule: 'เสาร์-อาทิตย์',
      },
    ],
    facilities: ['ทางเรียบ', 'มีม้านั่ง', 'มีห้องน้ำ', 'มีร่มเงา'],
    disclaimer: 'ข้อมูลอัปเดต [วันที่ตรวจเช็ค]',
    navigation: {
      distanceText: '1.5 กม.',
      walkTimeText: 'เดินราว 22 นาที',
    },
    nearbyPlaces: [
      {
        id: 'rom-sai',
        name: 'สวนชุมชนร่มไทร',
        description: 'ใกล้ที่นี่ 1.5 กม.',
        icon: '🌳',
      },
    ],
  },
};

export const MOCK_INITIAL_PLANS: ActivityPlanItem[] = [
  {
    id: 'plan-1',
    placeId: 'rom-sai',
    placeName: 'เดินเล่นที่สวนชุมชนร่มไทร',
    dayText: 'วันนี้',
    timeText: '16:30 น. • เตือนในแชต',
    reminderText: 'เตือนในแชต',
    companionStatus: '✓ นัดเพื่อนไปด้วย',
    status: 'upcoming',
  },
  {
    id: 'plan-2',
    placeId: 'wat-samakkhi',
    placeName: 'ชมรมทำอาหาร วัดสามัคคีธรรม',
    dayText: 'พุธ 29 ต.ค.',
    timeText: '09:00 น. • ไม่ได้ตั้งเตือน',
    reminderText: 'ไม่ได้ตั้งเตือน',
    companionStatus: '🕒 รอคุณสมชายตอบ',
    status: 'upcoming',
  },
];

export const MOCK_WISHLIST: WishlistItem[] = [
  {
    id: 'wish-1',
    name: 'ตลาดเช้าชุมชน',
    distanceText: '800 ม. • เปิด 06:00 น.',
    openingHoursText: 'เปิด 06:00 น.',
    icon: '🍜',
    category: 'อาหาร',
  },
  {
    id: 'wish-2',
    name: 'สวนสมุนไพรชุมชน',
    distanceText: '1.5 กม.',
    icon: '🌱',
    category: 'สวน',
  },
];
