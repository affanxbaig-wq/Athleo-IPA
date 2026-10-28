export type SocialPost = {
  id: string;
  user: string;
  handle: string;
  timeAgo: string;
  avatar: string;
  text: string;
  likes: number;
  comments: number;
  shares: number;
  image?: string;
  workout?: {
    title: string;
    volume: string;
    duration: string;
    pr: string;
  };
};

export type SuggestedPerson = {
  id: string;
  name: string;
  goal: string;
  avatar: string;
};

export const socialPosts: SocialPost[] = [
  {
    id: 'post-1',
    user: 'Ayesha Khan',
    handle: '@ayeshamoves',
    timeAgo: '12m ago',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    text: 'Strong session this morning. Little by little, stronger together. #StrongerTogether #Athleo',
    likes: 238,
    comments: 19,
    shares: 14,
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80',
    workout: {title: 'Upper Push + Core', volume: '4,260 kg', duration: '54 min', pr: 'Bench +5kg'},
  },
  {
    id: 'post-2',
    user: 'Hamza Ali',
    handle: '@hamzafit',
    timeAgo: '1h ago',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    text: 'Recovery day was on point. Sleep and hydration made a huge difference. #RecoveryWins #Consistency',
    likes: 176,
    comments: 12,
    shares: 7,
  },
  {
    id: 'post-3',
    user: 'Maham Siddiqui',
    handle: '@mahamathleo',
    timeAgo: '3h ago',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=300&q=80',
    text: 'New PR on deadlift and a clean 7-day streak. Energy is finally where it should be.',
    likes: 341,
    comments: 26,
    shares: 18,
    workout: {title: 'Deadlift Session', volume: '8,100 kg', duration: '47 min', pr: 'Deadlift 170kg'},
  },
];

export const suggestedPeople: SuggestedPerson[] = [
  {id: 'p1', name: 'Noor Aslam', goal: 'Muscle gain', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80'},
  {id: 'p2', name: 'Zain Iqbal', goal: 'Strength', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80'},
  {id: 'p3', name: 'Sara Gill', goal: 'Fat loss', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80'},
];

export const groups = [
  {id: 'g1', name: 'Athleo City Crew', members: '482 members'},
  {id: 'g2', name: 'Lean Strong', members: '219 members'},
  {id: 'g3', name: 'Hypertrophy Lab', members: '739 members'},
];
