export interface ActivityCategory {
  id: string;
  name: string;
  icon: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  itemCount: number;
}

export interface ActivityPlace {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  tag: string;
  imageUrl: string;
  heroImageUrl?: string;
  distanceText: string;
  distanceMeters: number;
  walkTimeText: string;
  isOpen: boolean;
  statusText: string;
  priceText: string;
  terrainText: string;
  matchingReason: string;
  isWishlisted?: boolean;
  whyRecommended: {
    title: string;
    body: string;
    historyNote?: string;
  };
  activities: Array<{
    title: string;
    schedule: string;
  }>;
  facilities: string[];
  disclaimer: string;
  navigation: {
    distanceText: string;
    walkTimeText: string;
  };
  nearbyPlaces: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

export interface ActivityPlanItem {
  id: string;
  placeId: string;
  placeName: string;
  dayText: string;
  timeText: string;
  reminderText?: string;
  companionStatus?: string;
  status: 'upcoming' | 'completed';
}

export interface WishlistItem {
  id: string;
  name: string;
  distanceText: string;
  openingHoursText?: string;
  icon: string;
  category: string;
}
