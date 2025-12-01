/**
 * Celebrity Batch Data - First Import
 *
 * This file contains celebrity accounts to be imported into the app.
 * Each celebrity has their profile info and a list of businesses they endorse.
 */

export interface CelebrityData {
  name: string;
  location: string;
  description: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  endorsements: string[];
}

export const celebrityBatch1: CelebrityData[] = [
  {
    name: "Taylor Swift",
    location: "Nashville, TN",
    description: "Global pop superstar and singer-songwriter",
    website: "taylorswift.com",
    twitter: "taylorswift13",
    instagram: "taylorswift",
    endorsements: [
      "AT&T", "Capital One", "Apple Music", "Diet Coke", "CoverGirl",
      "Elizabeth Arden", "Keds", "American Express", "Target", "Walmart",
      "Starbucks", "Got Milk?", "L.E.I. Jeans", "Band Hero", "Comcast/Xfinity",
      "Papyrus", "Jakks Pacific", "Cornetto", "Taylor Guitars", "Stella McCartney"
    ]
  },
  {
    name: "Cristiano Ronaldo",
    location: "Riyadh, Saudi Arabia",
    description: "Greatest soccer player of all time",
    website: "cristiano.com",
    twitter: "Cristiano",
    instagram: "cristiano",
    endorsements: [
      "Nike", "Herbalife", "Clear", "CR7 Brand", "Binance",
      "Louis Vuitton", "TAG Heuer", "Garmin", "Altice", "Emirates",
      "Abbott", "Jacob & Co", "Castrol", "Armani", "PokerStars",
      "Opel", "Dolce & Gabbana", "Shopee", "Eggo", "Nike Mercurial"
    ]
  },
  {
    name: "Lionel Messi",
    location: "Fort Lauderdale, FL",
    description: "Soccer legend and Inter Miami captain",
    website: "messiverse.com",
    twitter: "LeoMessi",
    instagram: "leomessi",
    endorsements: [
      "Adidas", "Pepsi", "Mastercard", "Huawei", "Gatorade",
      "Lay's", "Konami/eFootball", "Budweiser", "Hard Rock Cafe", "Maserati",
      "Lays", "Tata Motors", "Orbia", "JBL", "Socios.com",
      "Bitget", "Sirin Labs", "Ooredoo", "Mengniu Dairy", "Hawkers Sunglasses"
    ]
  },
  {
    name: "Luka Dončić",
    location: "Dallas, TX",
    description: "Dallas Mavericks superstar guard",
    twitter: "luka7doncic",
    instagram: "lukadoncic",
    endorsements: [
      "Jordan Brand/Nike", "Panini", "Gatorade", "BioSteel", "2K Sports",
      "Tissot", "Ria Money Transfer", "Unicef", "Coca-Cola", "BMW",
      "IWC Schaffhausen", "Air Jordan", "Beats by Dre", "Hyperice", "Whoop",
      "Foot Locker", "NBA Top Shot", "TradingView", "Coca-Cola Zero", "H-E-B"
    ]
  },
  {
    name: "Dwayne Johnson",
    location: "Los Angeles, CA",
    description: "Actor, wrestler, highest-paid entertainer",
    website: "therock.com",
    twitter: "TheRock",
    instagram: "therock",
    endorsements: [
      "Under Armour/Project Rock", "Teremana Tequila", "ZOA Energy", "Apple", "Salt & Straw Ice Cream",
      "Voss Water", "Ford", "Monster Energy", "Seven Bucks Productions", "Acorns",
      "UFC", "JBL", "Hobson & Hobson", "Atom Tickets", "American Express",
      "MilkPEP (Got Milk?)", "Lyft", "Chase", "Panini", "Ballers (HBO)"
    ]
  },
  {
    name: "Kim Kardashian",
    location: "Hidden Hills, CA",
    description: "Reality star, SKIMS & SKKN billionaire",
    website: "kimkardashian.com",
    twitter: "KimKardashian",
    instagram: "kimkardashian",
    endorsements: [
      "SKIMS", "SKKN by Kim", "Balenciaga", "Coty/KKW Beauty", "Carolina Lemke Eyewear",
      "Good American", "Fashion Nova", "Flat Tummy Co", "SugarBearHair", "Manuka Doctor",
      "ShoeDazzle", "Uber", "Calvin Klein", "Beats by Dre", "Bang Energy",
      "Morphe", "PrettyLittleThing", "Nintendo", "T-Mobile", "Perfect Moment"
    ]
  },
  {
    name: "Justin Bieber",
    location: "Beverly Hills, CA",
    description: "Canadian pop superstar",
    website: "justinbiebermusic.com",
    twitter: "justinbieber",
    instagram: "justinbieber",
    endorsements: [
      "Calvin Klein", "Drew House", "Balenciaga", "Adidas", "Tim Hortons",
      "Proactiv", "Schmidt's Naturals", "OPI Nail Polish", "Nicole by OPI", "Beats by Dre",
      "Vespa", "Xiaomi", "Walmart", "Elizabeth Arden", "Haus Labs",
      "Crocs", "Balmain", "H&M", "Quay Australia", "Schmidt's Deodorant"
    ]
  },
  {
    name: "Kevin Hart",
    location: "Calabasas, CA",
    description: "Comedian, actor, entrepreneur",
    website: "kevinhartnation.com",
    twitter: "KevinHart4real",
    instagram: "kevinhart4real",
    endorsements: [
      "Fabletics Men", "Gran Coramino Tequila", "Hart House", "Chase", "DraftKings",
      "SiriusXM", "Lyft", "Tommy John", "Hydrow", "Sam's Club",
      "Beyond Meat", "Nutrabolt", "Rally Health", "Old Spice", "Mountain Dew",
      "Nike", "PokerStars", "Vitamin Water", "Foot Locker", "JBL"
    ]
  },
  {
    name: "LeBron James",
    location: "Los Angeles, CA",
    description: "NBA GOAT, entrepreneur",
    website: "lebronjames.com",
    twitter: "KingJames",
    instagram: "kingjames",
    endorsements: [
      "Nike", "Pepsi/MTN Dew", "Beats by Dre", "Rimowa", "Walmart",
      "Blaze Pizza", "Calm App", "Ladder Supplements", "GMC Hummer EV", "Crypto.com",
      "DraftKings", "Tonal", "Fenway Sports Group", "Liverpool FC", "Boston Red Sox",
      "Lobos 1875 Tequila", "Taco Bell", "Sprite", "State Farm", "Kia"
    ]
  },
  {
    name: "Kevin Durant",
    location: "Phoenix, AZ",
    description: "2× NBA champion, scoring machine",
    website: "thirtyfiveventures.com",
    twitter: "KDTrey5",
    instagram: "easymoneysniper",
    endorsements: [
      "Nike", "Coinbase", "Weedmaps", "Alaska Airlines", "NBA Top Shot",
      "Degree", "Google", "Panini", "American Express", "Master & Dynamic",
      "Sprite", "Gatorade", "Sparkling Ice", "Beats by Dre", "Hyperice",
      "Whoop", "Boardroom", "The Players' Tribune", "Thirty Five Ventures", "SeatGeek"
    ]
  },
  {
    name: "Tom Brady",
    location: "Miami, FL",
    description: "7× Super Bowl champion",
    website: "tb12sports.com",
    twitter: "TomBrady",
    instagram: "tombrady",
    endorsements: [
      "Under Armour", "Brady Brand", "Hertz", "FTX", "Autograph (NFT)",
      "IWC Schaffhausen", "Upper Deck", "Molecule Mattresses", "Christopher Cloos Eyewear", "Subway",
      "Sam Adams", "Aston Martin", "Tostitos", "Tag Heuer", "Foot Locker",
      "UGG", "Shields", "Hyperice", "Fanatics", "Wheels Up"
    ]
  },
  {
    name: "Shaquille O'Neal",
    location: "Orlando, FL",
    description: "NBA legend, businessman, DJ",
    website: "shaq.com",
    twitter: "SHAQ",
    instagram: "shaq",
    endorsements: [
      "Reebok", "Icy Hot", "Papa John's", "The General Insurance", "Epson",
      "Carnival Cruise", "Lyft", "Ring", "Pepsi", "Vitamin Water",
      "Gold Bond", "Zales", "Buick", "Forever 21", "Krispy Kreme",
      "Shaq Fu Radio", "Muscle Milk", "Monster", "TNT", "Oreo"
    ]
  },
  {
    name: "Patrick Mahomes",
    location: "Kansas City, MO",
    description: "Chiefs QB, 3× Super Bowl champ",
    website: "15andthemahomies.com",
    twitter: "PatrickMahomes",
    instagram: "patrickmahomes",
    endorsements: [
      "Adidas", "State Farm", "Oakley", "Hy-Vee", "BioSteel",
      "Head & Shoulders", "Essentia Water", "Helzberg Diamonds", "CommunityAmerica CU", "Airshare",
      "Whoop", "T-Mobile", "DirectTV", "GoodCent$", "Whataburger",
      "Great Clips", "Old Spice", "Bose", "Subway", "Hunt's Ketchup"
    ]
  },
  {
    name: "Joe Burrow",
    location: "Cincinnati, OH",
    description: "Bengals QB, 2021 Comeback Player",
    twitter: "JoeyB",
    instagram: "joeyb_9",
    endorsements: [
      "Nike", "Bose", "BodyArmor", "Fanatics", "Kroger",
      "Beats by Dre", "Gucci", "Louis Vuitton", "Cartier", "Celine",
      "Nerf", "Raising Cane's", "Skyline Chili", "LaRosa's Pizzeria", "Gold Star Chili",
      "Hyperice", "Buffaloe's Wings", "Mercedes-Benz", "Rolex", "Tom Ford"
    ]
  },
  {
    name: "Josh Allen",
    location: "Buffalo, NY",
    description: "Bills QB, MVP candidate",
    twitter: "JoshAllenQB",
    instagram: "joshallenqb",
    endorsements: [
      "Nike", "New Era", "Gatorade", "Pepsi", "Microsoft Surface",
      "Ply Gem Windows", "Wegmans", "Tim Hortons", "Buffalo Wild Wings", "Hyundai",
      "Verizon", "Panini", "Topps", "M&T Bank", "Tommy John",
      "Old Spice", "GEICO", "Bose", "Hyperice", "Labatt Blue"
    ]
  },
  {
    name: "Shohei Ohtani",
    location: "Los Angeles, CA",
    description: "Two-way MLB unicorn, Dodgers",
    website: "shoheiohtani.com",
    twitter: "shoheiohtani",
    instagram: "shoheiohtani",
    endorsements: [
      "New Balance", "Fanatics", "Hugo Boss", "Seiko", "Japan Airlines",
      "Porsche", "Mitsubishi Bank", "Kose Cosmetics", "Salesforce", "Asahi Beer",
      "Descente", "Topps", "Nikon", "Mitsui", "Rakuten",
      "JAL", "Nippon Airways", "Hublot", "FTC Skincare", "SECOM"
    ]
  },
  {
    name: "Phil Mickelson",
    location: "Rancho Santa Fe, CA",
    description: "6× major champion, LIV Golf",
    website: "philmickelson.com",
    twitter: "PhilMickelson",
    instagram: "philmickelson",
    endorsements: [
      "Callaway", "Rolex", "Mizzen+Main", "Amgen/Intellia", "Workday",
      "KPMG", "Barclays", "ExxonMobil", "Grayhawk", "Titleist",
      "Ford", "Enbrel", "Psoriatic Arthritis Campaign", "Coffee for Wellness", "OptiShot",
      "Melin Hats", "For Wellness Coffee", "Hyperice", "VistaJet", "BetMGM"
    ]
  },
  {
    name: "Scottie Scheffler",
    location: "Dallas, TX",
    description: "World #1 golfer, 2024 Masters champion",
    instagram: "scottie.scheffler",
    endorsements: [
      "Nike", "TaylorMade", "Rolex", "NetJets", "Titleist",
      "Veritex Bank", "Greyson Clothiers", "SRIXON", "Cleveland Golf", "Truist",
      "Coca-Cola", "Mastercard", "Coca-Cola", "American Express", "FootJoy",
      "Charles Schwab", "Dell Technologies", "Bridgestone", "Whoop", "Hyperice"
    ]
  },
  {
    name: "Tiger Woods",
    location: "Jupiter Island, FL",
    description: "15× major champion, golf icon",
    website: "tigerwoods.com",
    twitter: "TigerWoods",
    instagram: "tigerwoods",
    endorsements: [
      "TaylorMade", "Bridgestone Golf", "Rolex", "Monster Energy", "Hero MotoCorp",
      "Full Swing Simulators", "PopStroke", "Kowa", "Upper Deck", "Nike",
      "Gatorade", "Tag Heuer", "Buick", "Gillette", "Accenture",
      "Centinel Spine", "Discovery Education", "PGA Tour Live", "2K Sports", "TGR Ventures"
    ]
  },
  {
    name: "Aaron Rodgers",
    location: "Malibu, CA",
    description: "Jets QB, 4× NFL MVP",
    website: "aaronrodgers12.com",
    twitter: "AaronRodgers12",
    instagram: "aaronrodgers12",
    endorsements: [
      "Adidas", "State Farm", "Bose", "Pizza Hut", "Prevea Health",
      "Sharp Aquos", "IZOD", "Cash App", "Zenith Watches", "North Dakota Tourism",
      "Bergstrom Auto", "Associated Bank", "Panini", "Jersey Mike's", "Milwaukee Bucks",
      "Flex", "CBDMD", "Hyperice", "Whoop", "Patagonia"
    ]
  },
  {
    name: "Leonardo DiCaprio",
    location: "Los Angeles, CA",
    description: "Oscar-winning actor, climate activist",
    website: "leonardodicaprio.foundation",
    twitter: "LeoDiCaprio",
    instagram: "leonardodicaprio",
    endorsements: [
      "Tag Heuer", "BYD", "Fiat", "Jim Beam", "Oppo",
      "L'Oréal", "Toyota Prius", "Beyond Meat", "Allbirds", "LVMH",
      "Mobli", "Natural Sapphire Company", "Apple", "Fisker", "RIMOWA",
      "Stella Artois", "Wyld Whisky", "Love On", "Re:wild", "Earth Alliance"
    ]
  },
  {
    name: "Matthew McConaughey",
    location: "Austin, TX",
    description: "Oscar-winning actor, alright alright alright",
    website: "mcconaughey.com",
    twitter: "McConaughey",
    instagram: "officiallymcconaughey",
    endorsements: [
      "Lincoln Motor Company", "Wild Turkey Bourbon", "Salesforce", "Dazed and Confused merch", "University of Texas",
      "Austin FC", "Longbranch Bourbon", "Howler Brothers", "Richard's Rainwater", "Mack, Jack & McConaughey",
      "Jordan Speith Golf", "Yeti", "Stetson", "Wrangler", "Dolce & Gabbana",
      "John Varvatos", "Patagonia", "Criquet Shirts", "Tecovas Boots", "Greenlights Book"
    ]
  }
];
