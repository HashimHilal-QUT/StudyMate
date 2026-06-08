// avatars.js — all available emoji avatars for students

const AVATARS = [
  { key: "avatar_owl",      emoji: "🦉", label: "Owl" },
  { key: "avatar_fox",      emoji: "🦊", label: "Fox" },
  { key: "avatar_panda",    emoji: "🐼", label: "Panda" },
  { key: "avatar_cat",      emoji: "🐱", label: "Cat" },
  { key: "avatar_dog",      emoji: "🐶", label: "Dog" },
  { key: "avatar_lion",     emoji: "🦁", label: "Lion" },
  { key: "avatar_rabbit",   emoji: "🐰", label: "Rabbit" },
  { key: "avatar_bear",     emoji: "🐻", label: "Bear" },
  { key: "avatar_koala",    emoji: "🐨", label: "Koala" },
  { key: "avatar_penguin",  emoji: "🐧", label: "Penguin" },
  { key: "avatar_frog",     emoji: "🐸", label: "Frog" },
  { key: "avatar_wolf",     emoji: "🐺", label: "Wolf" },
  { key: "avatar_tiger",    emoji: "🐯", label: "Tiger" },
  { key: "avatar_hamster",  emoji: "🐹", label: "Hamster" },
  { key: "avatar_duck",     emoji: "🦆", label: "Duck" },
  { key: "avatar_monkey",   emoji: "🐵", label: "Monkey" },
  { key: "avatar_unicorn",  emoji: "🦄", label: "Unicorn" },
  { key: "avatar_dragon",   emoji: "🐲", label: "Dragon" },
  { key: "avatar_robot",    emoji: "🤖", label: "Robot" },
  { key: "avatar_alien",    emoji: "👽", label: "Alien" },
];

// Returns emoji for a given avatar key
function getAvatarEmoji(key) {
  const found = AVATARS.find(a => a.key === key);
  return found ? found.emoji : "🎓";
}
