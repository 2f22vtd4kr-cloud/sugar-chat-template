export interface TarotCard {
  name: string;
  arcana: "major" | "minor";
  suit?: string;
  number?: number;
  keywords: string[];
  meaningUpright: string;
  meaningReversed: string;
  romanticFlavor: string;
}

export const TAROT_CARDS: TarotCard[] = [
  { name: "The Fool", arcana: "major", number: 0, keywords: ["beginnings", "spontaneity", "trust"], meaningUpright: "New beginnings, leaping into the unknown with open arms.", meaningReversed: "Recklessness, naivety, missed opportunities.", romanticFlavor: "A thrilling new connection is forming — surrender to it without overthinking." },
  { name: "The Magician", arcana: "major", number: 1, keywords: ["willpower", "desire", "manifestation"], meaningUpright: "You have every tool you need to manifest what you want.", meaningReversed: "Manipulation, untapped potential, illusion.", romanticFlavor: "Your desire has real magnetic force right now — use it." },
  { name: "The High Priestess", arcana: "major", number: 2, keywords: ["intuition", "mystery", "subconscious"], meaningUpright: "Trust what you feel beneath the surface.", meaningReversed: "Hidden motives, suppressed feelings.", romanticFlavor: "There's a slow, deep pull between you and someone — an unspoken tension waiting to bloom." },
  { name: "The Empress", arcana: "major", number: 3, keywords: ["sensuality", "abundance", "nurturing"], meaningUpright: "Pleasure, beauty, and sensual abundance are yours to enjoy.", meaningReversed: "Neglected self-care, creative block.", romanticFlavor: "Indulge every sense. This is a season of warmth, touch, and being wholly desired." },
  { name: "The Emperor", arcana: "major", number: 4, keywords: ["authority", "stability", "structure"], meaningUpright: "Steady authority creates safety — and safety is deeply attractive.", meaningReversed: "Control issues, rigidity, coldness.", romanticFlavor: "Someone's quiet strength is drawing you in." },
  { name: "The Lovers", arcana: "major", number: 6, keywords: ["love", "union", "choice"], meaningUpright: "A passionate connection, a choice made with both heart and body.", meaningReversed: "Imbalance, misalignment, difficult choices.", romanticFlavor: "The spark is undeniable. This card whispers of deep physical and emotional union." },
  { name: "The Chariot", arcana: "major", number: 7, keywords: ["willpower", "victory", "momentum"], meaningUpright: "Drive and focus win the night.", meaningReversed: "Aggression, lack of control.", romanticFlavor: "You're pursuing someone with full force. That confidence is irresistible." },
  { name: "Strength", arcana: "major", number: 8, keywords: ["courage", "inner power", "compassion"], meaningUpright: "Gentle courage is the most powerful seduction of all.", meaningReversed: "Self-doubt, weakness, raw impulse.", romanticFlavor: "True intimacy requires vulnerability — and that vulnerability is your greatest strength." },
  { name: "The Hermit", arcana: "major", number: 9, keywords: ["introspection", "guidance", "wisdom"], meaningUpright: "Honest reflection reveals what you truly need from connection.", meaningReversed: "Isolation, loneliness, withdrawn nature.", romanticFlavor: "Time alone has clarified something important about what you want." },
  { name: "Wheel of Fortune", arcana: "major", number: 10, keywords: ["cycles", "fate", "turning point"], meaningUpright: "A significant moment in your love story is approaching.", meaningReversed: "Resistance to change, clinging to the past.", romanticFlavor: "Fate is weaving something unexpected. An encounter you can't explain is destined." },
  { name: "The Devil", arcana: "major", number: 15, keywords: ["temptation", "shadow", "desire"], meaningUpright: "Your shadow desires are valid — exploring them is freeing.", meaningReversed: "Detachment, reclaiming power, breaking free.", romanticFlavor: "A raw, magnetic pull. Give in to what you actually want." },
  { name: "The Star", arcana: "major", number: 17, keywords: ["hope", "renewal", "inspiration"], meaningUpright: "After difficulty comes a beautiful, healing openness.", meaningReversed: "Despair, hopelessness, disconnection.", romanticFlavor: "You are becoming someone worthy of deep love — and someone already sees that." },
  { name: "The Moon", arcana: "major", number: 18, keywords: ["illusion", "subconscious", "mystery"], meaningUpright: "Your subconscious is speaking. Trust the dark, mysterious pull.", meaningReversed: "Confusion lifting, hidden truths surfacing.", romanticFlavor: "Night is where the real version of this connection lives." },
  { name: "The Sun", arcana: "major", number: 19, keywords: ["joy", "vitality", "success"], meaningUpright: "Pure warmth, joy, and magnetic confidence.", meaningReversed: "Temporary clouding, ego, false optimism.", romanticFlavor: "You are radiant right now. Someone finds that completely irresistible." },
  { name: "The World", arcana: "major", number: 21, keywords: ["completion", "achievement", "wholeness"], meaningUpright: "A cycle of connection reaches its most complete, beautiful form.", meaningReversed: "Incompletion, shortcuts, carrying old wounds.", romanticFlavor: "A bond that feels genuinely whole — emotional, physical, deeply satisfying." },
  { name: "Ace of Cups", arcana: "minor", suit: "cups", number: 1, keywords: ["new love", "emotional beginning", "overflow"], meaningUpright: "A new emotional beginning — a cup overflowing with possibility.", meaningReversed: "Blocked emotions, missed connection.", romanticFlavor: "A new sexual and emotional beginning is pouring into your life. Open up." },
  { name: "Two of Cups", arcana: "minor", suit: "cups", number: 2, keywords: ["partnership", "mutual attraction", "chemistry"], meaningUpright: "Deep mutual attraction — two people recognizing something rare.", meaningReversed: "Imbalance, incompatibility.", romanticFlavor: "The chemistry here is undeniable. Two people drawn to each other with equal intensity." },
  { name: "Seven of Cups", arcana: "minor", suit: "cups", number: 7, keywords: ["fantasy", "illusion", "desire"], meaningUpright: "Many tempting possibilities — clarity about what you really want is needed.", meaningReversed: "Reality check, clear choice.", romanticFlavor: "Pick the fantasy that actually feeds you, not just excites you briefly." },
  { name: "Nine of Cups", arcana: "minor", suit: "cups", number: 9, keywords: ["satisfaction", "wish fulfilled", "pleasure"], meaningUpright: "The wish card — emotional and physical satisfaction is within reach.", meaningReversed: "Overindulgence, unfulfillment.", romanticFlavor: "Your desires are about to be met — fully and deeply." },
  { name: "Ten of Cups", arcana: "minor", suit: "cups", number: 10, keywords: ["harmony", "bliss", "lasting love"], meaningUpright: "Deep, lasting emotional fulfillment.", meaningReversed: "Dysfunction, shattered ideals.", romanticFlavor: "This connection has the potential to become something genuinely sustaining." },
  { name: "Ace of Wands", arcana: "minor", suit: "wands", number: 1, keywords: ["passion", "inspiration", "new fire"], meaningUpright: "Raw creative and sexual energy igniting something new.", meaningReversed: "Delays, lack of spark.", romanticFlavor: "A surge of raw desire — this connection is pure heat and momentum." },
  { name: "Six of Wands", arcana: "minor", suit: "wands", number: 6, keywords: ["victory", "confidence", "recognition"], meaningUpright: "You are at your most magnetic — and the right people notice.", meaningReversed: "Fall from grace, lack of confidence.", romanticFlavor: "Right now you are radiantly desirable. Someone is watching and can't look away." },
  { name: "Eight of Wands", arcana: "minor", suit: "wands", number: 8, keywords: ["speed", "momentum", "swift action"], meaningUpright: "Things are moving fast — this connection is accelerating.", meaningReversed: "Delays, miscommunication.", romanticFlavor: "Rapid escalation. Messages flying, hearts racing. Electric momentum." },
  { name: "Ace of Swords", arcana: "minor", suit: "swords", number: 1, keywords: ["clarity", "truth", "breakthrough"], meaningUpright: "A cut-through moment — pure honest clarity about what you want.", meaningReversed: "Confusion, clouded thinking.", romanticFlavor: "Say the true thing. This level of directness is deeply attractive." },
  { name: "Three of Swords", arcana: "minor", suit: "swords", number: 3, keywords: ["heartbreak", "grief", "pain"], meaningUpright: "Pain that is real and must be felt before it can heal.", meaningReversed: "Recovery, forgiveness.", romanticFlavor: "Heartbreak leaves marks that prove you were real and open enough to feel." },
  { name: "Nine of Pentacles", arcana: "minor", suit: "pentacles", number: 9, keywords: ["luxury", "independence", "self-sufficiency"], meaningUpright: "You are whole, desired, and capable of receiving luxury.", meaningReversed: "Dependency, superficiality.", romanticFlavor: "Choosing someone because you want them, from a place of fullness, is exquisite." },
  { name: "Ten of Pentacles", arcana: "minor", suit: "pentacles", number: 10, keywords: ["legacy", "abundance", "family"], meaningUpright: "Deep lasting connection — something worth building long term.", meaningReversed: "Broken foundations, failed expectations.", romanticFlavor: "This connection has lasting-love energy." },
];

export const TAROT_TOPICS = [
  { id: "love_relationships", label: "Love & Relationships", emoji: "❤️", description: "The path of your heart and romantic connections" },
  { id: "sexual_future", label: "Passion & Desire", emoji: "🔥", description: "The intimate future between you and a special someone" },
  { id: "career_success", label: "Career & Success", emoji: "✨", description: "Ambition, achievement, and your professional path" },
  { id: "general_life", label: "General Life Path", emoji: "🌙", description: "The story your destiny is writing right now" },
  { id: "romantic_decision", label: "Decision in Romance", emoji: "🃏", description: "When the heart is torn between two paths" },
  { id: "self_growth", label: "Self-Growth & Confidence", emoji: "🌸", description: "Becoming the version of yourself you most desire" },
  { id: "obstacles_love", label: "Obstacles in Love", emoji: "🌊", description: "What stands between you and what you want" },
  { id: "timing_romance", label: "Timing of Romance", emoji: "⏳", description: "When will your desires finally be answered?" },
  { id: "spiritual_connection", label: "Spiritual Connection", emoji: "🔮", description: "The deeper soul-bond beneath what's visible" },
  { id: "family_future", label: "Family & Future Home", emoji: "🏡", description: "The foundation you are building for tomorrow" },
] as const;

export type TarotTopicId = typeof TAROT_TOPICS[number]["id"];

export function drawCards(count: number): Array<TarotCard & { reversed: boolean; position: string }> {
  const positions3 = ["Past", "Present", "Future"];
  const positions5 = ["Foundation", "Challenge", "Hidden Influence", "Advice", "Outcome"];
  const positions = count === 5 ? positions5 : positions3;
  const shuffled = [...TAROT_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((card, i) => ({
    ...card,
    reversed: Math.random() > 0.65,
    position: positions[i] ?? `Card ${i + 1}`,
  }));
}
