import { seedAvatar } from './avatar'
import type { Gender, NerdClass, Profile } from './types'

type Raw = [name: string, age: number, gender: Gender, city: string, nerdClass: NerdClass, tagline: string, interests: string[], bio: string]

const RAW: Raw[] = [
  ['Ada Byteworth', 24, 'Woman', 'Brooklyn, NY', 'Code Wizard', 'Will debug your heart in O(1).', ['Rust', 'Mech keyboards', 'Tea'], 'Backend dev by day, synth-wave producer by night. I rewrote my toaster firmware. It is now faster and slightly sentient.'],
  ['Milo Quark', 27, 'Man', 'Austin, TX', 'Lab Rat', 'Particle physics & pizza rolls.', ['Physics', 'Lego Technic', 'Pizza'], 'PhD student. Currently teaching a neural net to tell apart cats and croissants. Accuracy: 51%. Ask me about quarks, I dare you.'],
  ['Luna Pixelheart', 22, 'Woman', 'Seattle, WA', 'Anime Scholar', 'Studio Ghibli is a personality.', ['Anime', 'Watercolor', 'Boba'], 'Illustrator who cries at every Miyazaki movie. Looking for someone to argue about sub vs dub (sub, obviously).'],
  ['Rex Dungeonson', 29, 'Man', 'Denver, CO', 'Lore Keeper', 'Your DM. Roll for initiative.', ['D&D', 'Tolkien', 'Hiking'], 'Running a 4-year homebrew campaign. I own 312 dice and I know each one by name. Chaotic good, lawful snacks.'],
  ['Kiki Nakamura', 25, 'Woman', 'San Francisco, CA', 'Speedrunner', 'Any% world record holder (in my heart).', ['Speedruns', 'Celeste', 'Ramen'], 'I can beat Super Metroid in 47 minutes and still be late to brunch. Frame-perfect texting, sometimes.'],
  ['Theo Primes', 23, 'Man', 'Boston, MA', 'Math Olympian', 'I find you irrational. In a good way.', ['Number theory', 'Chess', 'Jazz'], 'Math tutor. I will absolutely explain why 0.999... equals 1 on the first date. You have been warned.'],
  ['Juniper Vale', 26, 'Non-binary', 'Portland, OR', 'Lab Rat', 'Mushrooms are the internet of the forest.', ['Mycology', 'Vinyl', 'Foraging'], 'Mycologist & amateur radio operator. My call sign is cooler than your call sign. Plant parent to 41 succulents.'],
  ['Gus Kernel', 31, 'Man', 'Chicago, IL', 'Code Wizard', 'I use Arch btw.', ['Linux', 'Vim', 'Coffee'], 'Kernel hacker. I have strong opinions about tabs vs spaces and even stronger ones about deep dish.'],
  ['Priya Nebula', 24, 'Woman', 'Houston, TX', 'Lab Rat', 'Rocket scientist. Literally.', ['Astronomy', 'KSP', 'Salsa'], 'Propulsion engineer. I have launched 14 rockets in Kerbal and 2 in real life. Looking for my co-pilot.'],
  ['Otto Checkmate', 28, 'Man', 'Minneapolis, MN', 'Chess Goblin', '1800 Elo, 0 rizz. Fixable?', ['Chess', 'Puzzles', 'Board games'], 'I play the Bongcloud unironically. My love language is sending you a mate-in-three at 2am.'],
  ['Zara Circuit', 23, 'Woman', 'Los Angeles, CA', 'Code Wizard', 'Hardware hacker with a soldering iron heart.', ['Arduino', 'Cosplay', 'EDM'], 'I built LED wings for my cosplay that sync to music. Currently building a robot that makes perfect pancakes.'],
  ['Felix Hexa', 26, 'Man', 'Miami, FL', 'Crypto Degen', 'Down bad but diamond-handed.', ['Solana', 'Memes', 'Surfing'], 'Bought the top, held the bottom, still smiling. I read whitepapers for fun and charts for emotional damage.'],
  ['Mei Lin Opcode', 27, 'Woman', 'New York, NY', 'Math Olympian', 'Statistically, you should message me.', ['Statistics', 'Sudoku', 'Dumplings'], 'Data scientist. I ran a regression on my dating life. Results were not significant. Help me change that.'],
  ['Bram Scroll', 30, 'Man', 'Philadelphia, PA', 'Lore Keeper', 'Fantasy novel hoarder. 900+ books.', ['Fantasy', 'Calligraphy', 'History'], 'Librarian (the cool kind). I can recite the full line of succession for three fictional kingdoms.'],
  ['Nova Ramirez', 22, 'Woman', 'Phoenix, AZ', 'Speedrunner', 'Glitch hunter. Wall-clipper. Menace.', ['Retro games', 'Skateboarding', 'Tacos'], 'I find glitches in games and in people. Mostly harmless. Owns every Nintendo console ever made.'],
  ['Idris Vector', 25, 'Man', 'Atlanta, GA', 'Anime Scholar', 'One Piece is real.', ['Manga', 'Basketball', 'Beats'], 'Making lo-fi beats and reading manga until 4am. Will fight for Zoro. Looking for my nakama.'],
  ['Sol Achebe', 28, 'Non-binary', 'Oakland, CA', 'Crypto Degen', 'On-chain and off the charts.', ['DeFi', 'Poetry', 'Jazz'], 'Smart contract auditor who writes haiku about reentrancy bugs. Gas fees are my love language.'],
  ['Hazel Tensor', 26, 'Woman', 'Pittsburgh, PA', 'Code Wizard', 'Training models, not relationships (yet).', ['ML', 'Knitting', 'Cats'], 'AI researcher who knits sweaters for her cats. Both are overfitting. Tell me your favorite loss function.'],
  ['Wes Polygon', 24, 'Man', 'Salt Lake City, UT', 'Speedrunner', 'Low-poly artist, high-effort friend.', ['Blender', 'Indie games', 'Climbing'], 'Making an indie game about a frog who wants to be an astronaut. Wishlist it. Or me. Either works.'],
  ['Ivy Sigma', 23, 'Woman', 'Nashville, TN', 'Chess Goblin', 'I will checkmate you and then buy you coffee.', ['Chess', 'Country music', 'Baking'], 'Chess streamer (47 followers, all legends). Bakes a mean sourdough. Plays the Sicilian, emotionally too.'],
  ['Arjun Delta', 29, 'Man', 'San Diego, CA', 'Math Olympian', 'Calculus got me through heartbreak.', ['Calculus', 'Cricket', 'Chai'], 'Physics teacher. My students call me Mr. Derivative. My mom calls me single. Help me prove her wrong.'],
  ['Robin Glitch', 27, 'Non-binary', 'Detroit, MI', 'Code Wizard', 'Pixel art & punk rock.', ['Pixel art', 'Punk', 'Zines'], 'Makes pixel art zines and 8-bit covers of punk songs. Very loud, very soft. Pet: one extremely judgmental ferret.'],
  ['Clara Orbit', 25, 'Woman', 'Orlando, FL', 'Lab Rat', 'Marine biologist. Octopus defender.', ['Oceans', 'Diving', 'Sci-fi'], 'I study cephalopods. Octopuses have 9 brains and still can’t figure out dating either. We are the same.'],
  ['Dex Mainframe', 32, 'Man', 'Seattle, WA', 'Lore Keeper', 'Star Trek > Star Wars. Fight me (gently).', ['Star Trek', 'Retro PCs', 'Cooking'], 'Collects vintage computers. My Commodore 64 still boots. So does my heart, eventually. Makes a mean lasagna.'],
]

export function makeSeedProfiles(now: number): Profile[] {
  return RAW.map(([name, age, gender, city, nerdClass, tagline, interests, bio], i) => {
    const id = 'bot_' + name.toLowerCase().replace(/[^a-z]+/g, '_')
    const lookingFor: Profile['lookingFor'] = gender === 'Man' ? 'Woman' : gender === 'Woman' ? (i % 3 === 0 ? 'Everyone' : 'Man') : 'Everyone'
    const rj = Math.floor(((i * 37) % 97) * (gender === 'Man' ? 2.6 : 0.8))
    return {
      id,
      name,
      age,
      gender,
      pronouns: gender === 'Man' ? 'he/him' : gender === 'Woman' ? 'she/her' : 'they/them',
      lookingFor,
      city,
      distanceKm: Math.round(((i * 53) % 480) / (i % 4 === 0 ? 40 : 1) * 10) / 10 + 0.4,
      nerdClass,
      tagline,
      bio,
      interests,
      photos: [],
      avatar: seedAvatar(id),
      phone: `+1 (555) ${String(200 + ((i * 71) % 700)).padStart(3, '0')}-${String(1000 + ((i * 331) % 8999)).padStart(4, '0')}`,
      joinedAt: now - (i % 5 === 0 ? i * 3600_000 : (i + 3) * 86400_000 * 2),
      rejectionsGiven: (i * 13) % 40,
      rejectionsReceived: rj,
      accepts: (i * 7) % 11,
      verified: i % 3 !== 1,
    }
  })
}
