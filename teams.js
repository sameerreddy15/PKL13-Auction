const TEAMS = [
  {id:'GG', name:'Gujarat Giants', logo:'assets/gujarat.png', retentionProfile:{threshold:62,starBias:1.08}},
  {id:'BW', name:'Bengal Warriorz', logo:'assets/bengal.png', retentionProfile:{threshold:60,starBias:1.05}},
  {id:'DD', name:'Dabang Delhi K.C.', logo:'assets/dabang.png', retentionProfile:{threshold:66,starBias:1.12}},
  {id:'PP', name:'Patna Pirates', logo:'assets/patna.png', retentionProfile:{threshold:58,starBias:1.02}},
  {id:'TML', name:'Tamil Thalaivas', logo:'assets/tamil.png', retentionProfile:{threshold:64,starBias:1.08}},
  {id:'HS', name:'Haryana Steelers', logo:'assets/haryana.png', retentionProfile:{threshold:61,starBias:1.06}},
  {id:'BB', name:'Bengaluru Bulls', logo:'assets/bulls.png', retentionProfile:{threshold:63,starBias:1.07}},
  {id:'TIT', name:'Telugu Titans', logo:'assets/telugu.png', retentionProfile:{threshold:60,starBias:1.05}},
  {id:'UM', name:'U Mumba', logo:'assets/mumba.png', retentionProfile:{threshold:65,starBias:1.09}},
  {id:'PU', name:'Puneri Paltan', logo:'assets/puneri.png', retentionProfile:{threshold:67,starBias:1.14}},
  {id:'UP', name:'UP Yoddhas', logo:'assets/up.png', retentionProfile:{threshold:59,starBias:1.04}},
  {id:'JPP', name:'Jaipur Pink Panthers', logo:'assets/jaipur.png', retentionProfile:{threshold:62,starBias:1.10}}
];

const AI_PROFILES={
  GG:{aggression:.76,discipline:.72,star:.82,risk:.58,scouting:1.00},
  BW:{aggression:.68,discipline:.76,star:.72,risk:.45,scouting:1.08},
  DD:{aggression:.84,discipline:.56,star:.92,risk:.72,scouting:1.02},
  PP:{aggression:.64,discipline:.82,star:.68,risk:.42,scouting:1.10},
  TML:{aggression:.74,discipline:.70,star:.80,risk:.58,scouting:1.00},
  HS:{aggression:.69,discipline:.78,star:.74,risk:.48,scouting:1.06},
  BB:{aggression:.72,discipline:.73,star:.77,risk:.55,scouting:1.04},
  TIT:{aggression:.71,discipline:.70,star:.80,risk:.56,scouting:1.03},
  UM:{aggression:.66,discipline:.84,star:.67,risk:.40,scouting:1.12},
  PU:{aggression:.78,discipline:.67,star:.86,risk:.62,scouting:1.04},
  UP:{aggression:.70,discipline:.77,star:.75,risk:.50,scouting:1.07},
  JPP:{aggression:.80,discipline:.69,star:.88,risk:.65,scouting:1.03}
};
TEAMS.forEach(t=>t.aiProfile=AI_PROFILES[t.id]||{aggression:.7,discipline:.7,star:.75,risk:.5,scouting:1});
