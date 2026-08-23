// PKL 13 Auction Simulation - generated from the player lists supplied in chat.
// Duplicate rule: remove only exact duplicates within the same category/position/nationality group.

const CATEGORY_BASE_PRICE = { A: 3000000, B: 2000000, C: 1300000, D: 900000 };
const TEAM_PURSE = 50000000;

const AUCTION_ORDER = [
  ['A','Overseas','All-Rounder'], ['A','Overseas','Raider'], ['A','Overseas','Defender'],
  ['A','Domestic','All-Rounder'], ['A','Domestic','Raider'], ['A','Domestic','Defender'],
  ['B','Overseas','All-Rounder'], ['B','Overseas','Raider'], ['B','Overseas','Defender'],
  ['B','Domestic','All-Rounder'], ['B','Domestic','Raider'], ['B','Domestic','Defender'],
  ['C','Overseas','All-Rounder'], ['C','Overseas','Raider'], ['C','Overseas','Defender'],
  ['C','Domestic','All-Rounder'], ['C','Domestic','Raider'], ['C','Domestic','Defender'],
  ['D','Overseas','All-Rounder'], ['D','Overseas','Raider'], ['D','Overseas','Defender'],
  ['D','Domestic','All-Rounder'], ['D','Domestic','Raider'], ['D','Domestic','Defender']
];

function splitNames(value) {
  return value.split('|').map(s => s.trim()).filter(Boolean);
}

// category -> nationality -> position -> names
const RAW = {
A: {
 Overseas: {
  'All-Rounder': splitNames('Md. Reza Shadloui'),
  Raider: [],
  Defender: splitNames('Fazel Atrachali')
 },
 Domestic: {
  'All-Rounder': splitNames('Bharat Hooda|Pawan Sehrawat|Vijay Malik'),
  Raider: splitNames('Arjun Deshwal|Ashu Malik|Devank Dalal'),
  Defender: splitNames('Ankush Rathee|Shubham Shinde|Yogesh Dahiya|Deepak Rathee')
 }
},
B: {
 Overseas: {
  'All-Rounder': [], Raider: [], Defender: splitNames('Amir H. Bastami')
 },
 Domestic: {
  'All-Rounder': splitNames('Ankit Jaglan'),
  Raider: splitNames('Guman Singh|Maninder Singh|Manjeet Dahiya|Naveen Kumar|Sachin Tanwar|Nitin Dhankar'),
  Defender: splitNames('Nitesh Kumar|Sahil Gulia|Mahender Singh|Sanket Sawant|Rinku Sharma|Sanjay Dhull|Surjeet Singh')
 }
},
C: {
 Overseas: {
  'All-Rounder': splitNames('John Karuga Muremwa|Samuel Wanjala Wafula|Monirul Chowdhury|Jong Hoon Choi|Helvic Simuyu Wanjala|Ramu Tamatta|Rodgers Omondi Atieno|Ganesh Parki|Devinthirakumaar V. K.|Rattanakon Yotsungnoen|Han Eol Kim|Viknesshwaran Gunaseelan|Ryo Furihata|Komang Wahyu Brahmasta|Alireza Mirzaeian|Ahmadreza Asgari|Mohammad Ghorbani'),
  Raider: splitNames('Jang Kun Lee|Dong Geon Lee|James Namaba Kamweti|Md. Mijanur Rahman|Ju Hwan Kim|Allan Oduor Omondi|Ghanshyam Roka Magar|Junseok An|Nestor Mariano Pascual|Shahan Sha Mohammed|Shoya Suzuki|Tobius Kinyua Muriithi|Akikazu Izumi|Chayaphon Kamunee|Suresh Leong Kim Seng|Odhore Franklyne Otaya|Dipayon Golder|Milan Kumar Kaushal|Al Amin|Md Razib Ahamed|Hiroto Chiba|Ali Tolaqani|Chia-Ming Chang|Zheng-Wei Chen|Jyun Jie Li|Ali Samadi Choubtarash|Javad M. Dolatabadi|Milad Mohajer|Omid K. Mohammadshah|Mohammad E. Nabibakhsh'),
  Defender: []
 },
 Domestic: {
  'All-Rounder': splitNames('Aamir Wani|Afjal Khan|Ahmed Mustafa Enamdar|Akash Prasher|Amit Kumar|Arkam Shaikh|Ashish|Ashish Kumar (Sangwan)|BY Someshwar|Balaji D|Bhoir Akshay Bharat|Brijendra Singh Chaudhary|Gurdeep|Jitender Yadav|Mohit|Mohit Balyan|Narender Hooda|Naveen|Nitin Dalal|Nitin Panwar|Nitin Rawal|Omkar R. More|PM Chethan|Raj D. Salunkhe|Ran Singh|Ritik|Rohan Singh|Rohit|Rohit Gulia|Sachin Narwal|Sagar Kumar|Sajin Chandrasekar|Sanjeevi S|Sanskar Mishra|Santhapanaselvam|Shivansh Thakur|Sundaravishva R.|Tejas Maruti Patil|Vikas Jaglan|Visvanth V|Aakash Rudele|Sanchit Chandrkant Gawas|Nehal B Sawal Desai|Rajesh Narwal|Gursahib Singh|Dheeraj|Harkirat Singh|Mohammad Tabish|Kuldeep Singh Gour'),
  Defender: splitNames('Abinand Subhash|Aman|Amit Sheoran|Deepak Kumar|Manikandan S.|Manish|Naveen Sharma|Priyank Chandel|Rinku Narwal|Sagar|Sombir|Sourav Gulia|Sunder|Vishal Bhardwaj|Vijay Sani|Aditya S. Shinde|Aditya Shankar Powar|Akshay Kumar|Badal Taqdir Singh|Chethan S|Gaurav|Gaurav Dahiya|Girish Maruti Ernak|Hardeep|Harsh Mahesh Lad|Himanshu Choudhary|Kiran Laxman Magar|Lalit Gajram|Mayank Malik|Mohd. Amaan|Mohit|Naveen|Navneet|Nitesh|Rahul|Sandeep Kumar (Dhull)|Saurabh Nandal|Sourav|Sumit|Vaibhav Balasaheb Kamble|Vijay|Rushikesh Bhojane|Jitin Dasa Naik|Nikhil Krishnat Jadhav|Akshay Jaywant Bodake|Babu Murugasan|Darpan|Harendra Kumar|Harsh|Himmat Antil|Jaskirat Singh|Parteek|Parvesh Bhainswal|Prashant Kumar Rathi|Praveen Thakur|Ram Adhagle|Rohit Kumar|Shreyas Umbardand|Shubham Kumar|Siddhesh Tatkare|Ujjval Singh|Vikrant|Amit Nagar|Sumit Kumar|Aditya Kaushal|Akash Choudhary|Arpit Saroha|Arulnanthababu|Ashish Gill|Bittu|Dipak Arjun Shinde|Hem Raj|Ishwar|Jagdeep|Lucky Sharma|Mahendra Choudhary|Manuj|Monu|Sunil|Vinod R|Yash Hooda|Sushanth Shetty|Anuj Saini|Hasan M. Nishan|Aashish Kumar|Balasaheb Shahaji Jadhav|Gaurav Chhillar|Gokulakannan M.|Kapil Gurjar|Karan Singh|Lavish|Manokaran Abishek|Mayur Jagannath Kadam|Neeraj Kumar|Nitin|Pavan TR|Ponparthiban Subramanian|Rakshith|Ravi|Ravi Kumar|Sambhaji Wabale|Satyappa Matti|Shivam Singh Tomar|Sunny|Tushar Dattaray Adhavade|Vaibhav Bhausaheb Garje|Kuldeep Singh|Rama Krishna Velip'),
  Raider: splitNames('Akshaykumar Soni|Akshit|Aniket Mane|Arun Solanki|Gnana Abishek S|Kunal|M. Dhanasekar|Manu|Parveen|Rohit Yadav|Sahil Jandu|Saurav Parthe|Vikul Lamba|Bhargav Mandrekar|Yashraj|Prajwal S|Abhimanyu Raghuvanshi|Abhishek Singh|Ajinkya Ashok Pawar|Ajith V Kumar|Akash B Chavhan|Akash Santosh Shinde|Akshay R. Suryawanshi|Anil Kumar|Aniruddh Pandey|Anuj Kumar|Arjun Rathi|Ashish Narwal|Babloo Singh|Banty|Chandran Ranjith|Dhurvik Vijay Gohel|Gulveer Singh|Himanshu|Jai Bhagwan|Jatin|Jitesh Choudhary|K. Dharanidharan|K. Prapanjan|Kunal Mehta|Mahipal|Manjeet|Mayank Saini|Meetu|Monu|More G B|Navneet|Neeraj Narwal|Nitin|Nitin Singh|Parshant Kumar|Parvinder|Pranay Vinay Rane|R Guhan|Rahul Chaudhari|Rahul Choudhary|Rahul Kumar|Rajnish|Rakesh Narwal|Ramkumar Mayandi|Ranjit Venkatramana Naik|Ratan G|Rupesh|Sachin|Sai Prasad|Sandeep Kumar|Selvamani K|Shashank B|Shivam|Shrikant Jadhav|Shubham Nitin Shelke|Siddharth Sirish Desai|Sourabh Fagare|Suraj Panwar|Surender Ranvir|Sushil|Suyog Baban Gaikar|Upender Singh|Vijay Bajanthri|Vikash Khandola|Vinay|Vishal Chaudhary|Vishal Choudhary|Ashwin Pal|Atamjit Singh|Hariom Chaudhary|Harish Kumar Singh|Jatin Kumar|Manoj Choudhary|Piyush Jham|Rahul Choudhary|Aman Dalal|Kuldeep Kumar|Harmanjit Singh|Balraj Singh|Rajeev Singh|Aadesh Siwach|Aryavardhan Navale|Hemanth P|Jagdeep|Maharudra Garje|Masanamuthu Lakshnanan|Mithun M S|Nitin|Omkar Kumbhar|Omkar Narayan Patil|Rathan Sanjeeva|Robin Chaudhary|Saurabh Raut|Stuwart Singh|Shashank Acharya')
 }
},
D: {
 Overseas: {'All-Rounder': [], Raider: [], Defender: []},
 Domestic: {
  'All-Rounder': splitNames('Amarjeet|Moolchandra Singh|Sachin|Ankit|Sagar|Abhijit R. Gaikwad|Sahil Suhas Rane|Mithun|Lal Singh|Saksham Bhranta|Amit Singh Tomar|Kamraju Kadraka|Prakash Ghatak|Kishor Dandapathak|Sekh Surhab|Sandeep Gajjar|Janakraj Gorkha|Adesh Manohar Warkhade|D. Jegan|Himanshu Yadav|Suraj Singh|Gali Lakshma Reddy|Jayanta Biswas|Kulvinder Dalal|Kunal Tanwar|Rajan Singh Manhas|Suresh Jadhav|Sameer|D Ranjith|Yatharth Deswal|Amit Singh Thakur|Aanil Mohan|Amit|Abhishek Yadav|Sandeep Narwal'),
  Defender: splitNames('Sandeep|Amit|Rohan Ashok Tupare|Sumit|Sanjay|Rahul Dagar|Ajay Mor|Gagan Pinam|Ankit Sharma|Rakesh Gowda K A|Deepak Kumar|Rajesh Gurjar|Ritik|Nadish Barde|Yogesh|Neeraj Tomar|Ujjwal|Shreyas Raj K|Shubham Rahate|Parveen Narwal|Amrit Dev Singh|Ronak|Ankit|Harander|Vinod Choudhary|Yash Chauhan|Ashish|Ajay Nandal|Nikhil Singh Chauhan|Naveen Isharwal|Harichand Singh|Ashish Tarsariya|Gopineedi Pavan Kumar|Mokibur Rahman|Ankit Singh|Alankar Kaluram Patil|Sachin|Rakesh Bhalle Ram|Viraj Malik|Zubair|Saiprasad Tukaram Patil|Gaurav|Satyam Singh|Phool Chandra|Jayant Balasaheb Kale|Anant Rana|Vipul Chaudhary|Rajiv Chaudhary|Vishal Saini|Suhas N|Vikram Singh|Ganesh Raghuvanshi|Pravin Kumar|Ankit Sharma|M Lingaraj|Vijay|Jatin Singh|Ashish'),
  Raider: splitNames('Surender|Ashu Sukhdarshan|Toseef Ahmed|Mula Siva Ganesh Reddy|Umesh|Akash Nain|Uday Parte|Ajay Sangwan|Yuvraj|Ankit|Mandeep|Nikesh|Ajay Gulia|Raju Kathore|Pappu|Thungala Chandra|Suresh Mahadev Hadpad|Sushant Babruwan Shinde|Bhuvaneshwar Gaur|Anuj Negi|Sachin Panwar|Niroj Kumar Sethi|Rajesh Dehury|Vijay|Balraj Singh|Kesavan R|K Harish|Sourav Dahiya|Sumit|Sujal Sanjay Surjuse|Krupasagar D|Vignesh|Oruganti Suresh|Telugu Shiva Krishna|Chunchu Manoj Kumar Yadav|Ikti Ahmed|James Kumar Basumatary|Vishal|Gunimini Samarasimha Reddy|Potla Gopi Chand|Monu Kumar|Udaykant Kumar|Ajay Maravi|Surendra Singh Kanwar|Prashant Sharma|Vineet Mavi|Pandya Kishankumar|Anil Gurjar|Manjur Ali|Mayengbam Menson Singh|Karunakar Behera|Lyyappan V|Abhishek Dhabai|Rahul Sharma|Katabathini Ravi Teja|Bablu|Aman|Shubham Bitake|Aman|Tejas Kalbhor')
 }
}
};

function normalizeName(name) { return name.trim().toLowerCase().replace(/\s+/g, ' '); }
function buildPlayers() {
  const players = [];
  const seen = new Set();
  let n = 1;
  for (const [category, nationalityMap] of Object.entries(RAW)) {
    for (const [nationality, positionMap] of Object.entries(nationalityMap)) {
      for (const [position, names] of Object.entries(positionMap)) {
        for (const name of names) {
          const key = [normalizeName(name), category, position, nationality].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          players.push({
            id: `PKL13-${String(n++).padStart(4,'0')}`,
            name,
            category,
            position,
            nationality,
            basePrice: CATEGORY_BASE_PRICE[category],
            matches: null,
            raidPoints: null,
            tacklePoints: null,
            superRaids: null,
            superTackles: null,
            pkl12AuctionPrice: null,
            aiValuation: null,
            currentBid: 0,
            soldTo: null,
            soldPrice: 0,
            status: 'upcoming'
          });
        }
      }
    }
  }
  return players;
}

const players = buildPlayers();

const AI_TEAMS = [
  { id:'AI01', name:'Aggressive Titans', purse:TEAM_PURSE, aggression:92, patience:35, starPriority:95, bargainHunting:25, positionPriority:78, budgetDiscipline:30, competitionTolerance:92, lateBidding:75, riskTaking:90, historicalPriceWeight:55 },
  { id:'AI02', name:'Analytics Warriors', purse:TEAM_PURSE, aggression:50, patience:88, starPriority:58, bargainHunting:92, positionPriority:90, budgetDiscipline:94, competitionTolerance:55, lateBidding:85, riskTaking:28, historicalPriceWeight:82 },
  { id:'AI03', name:'Balanced Raiders', purse:TEAM_PURSE, aggression:67, patience:68, starPriority:72, bargainHunting:67, positionPriority:86, budgetDiscipline:76, competitionTolerance:70, lateBidding:62, riskTaking:54, historicalPriceWeight:70 },
  { id:'AI04', name:'Star Hunters', purse:TEAM_PURSE, aggression:89, patience:40, starPriority:99, bargainHunting:20, positionPriority:60, budgetDiscipline:25, competitionTolerance:87, lateBidding:71, riskTaking:93, historicalPriceWeight:60 },
  { id:'AI05', name:'Defence First', purse:TEAM_PURSE, aggression:61, patience:74, starPriority:45, bargainHunting:72, positionPriority:98, budgetDiscipline:84, competitionTolerance:66, lateBidding:58, riskTaking:45, historicalPriceWeight:75 },
  { id:'AI06', name:'Value Kings', purse:TEAM_PURSE, aggression:44, patience:92, starPriority:40, bargainHunting:97, positionPriority:76, budgetDiscipline:98, competitionTolerance:38, lateBidding:91, riskTaking:20, historicalPriceWeight:88 },
  { id:'AI07', name:'High Rollers', purse:TEAM_PURSE, aggression:95, patience:28, starPriority:91, bargainHunting:30, positionPriority:65, budgetDiscipline:22, competitionTolerance:96, lateBidding:80, riskTaking:97, historicalPriceWeight:48 },
  { id:'AI08', name:'Squad Builders', purse:TEAM_PURSE, aggression:58, patience:79, starPriority:60, bargainHunting:80, positionPriority:95, budgetDiscipline:90, competitionTolerance:52, lateBidding:68, riskTaking:35, historicalPriceWeight:77 }
];

if (typeof module !== 'undefined') module.exports = { CATEGORY_BASE_PRICE, TEAM_PURSE, AUCTION_ORDER, RAW, players, AI_TEAMS };
