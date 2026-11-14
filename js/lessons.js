// Learning Centre curriculum. Exercises use the app's phrase notation and are playable.
// drill: 'sustain' = live long-tone trainer, 'palta' = pattern generator.
export const LEVELS = ['Foundation', 'Beginner', 'Intermediate', 'Advanced', 'Professional'];

export const LESSONS = [
  { id: 'posture', level: 'Foundation', topic: 'Sound production', title: 'Posture, grip and first sound', mins: 10,
    intro: 'A relaxed body and a consistent embouchure decide your tone long before your fingers do.',
    points: [
      'Sit upright, shoulders loose, head level. Hold the flute to your right, roughly horizontal, tilted slightly down.',
      'Left hand nearest the blowing hole, palm facing you; right hand below, palm facing away. Cover the holes with the flat pads of the fingers, not the tips, and keep the fingers almost straight.',
      'Rest the flute on the lower lip so the lip covers about a quarter of the blowing hole. Shape the lips as if saying "pu" and direct a narrow stream of air across the far edge of the hole.',
      'Start with all holes open. When that note is clear and steady, close holes one at a time from the top.',
    ],
    exercises: [
      { label: 'Open-hole long tone', text: 'All holes open (tivra Ma). Ten breaths, each note as long and even as you can manage.' },
      { label: 'Adding fingers', phrase: 'M - - -, G - - -, R - - -, S - - -', text: 'Close one hole at a time from the top. Each added finger must seal completely before you blow.' },
    ],
    tips: ['An airy or missing note almost always means a finger is leaking or the lip is covering too much or too little of the hole.', 'Practise in front of a mirror to keep the air stream centred.'] },

  { id: 'breath', level: 'Foundation', topic: 'Breath control', title: 'Breath: the engine of the bansuri', mins: 12,
    intro: 'The bansuri uses more air than almost any other wind instrument. Breath capacity and, above all, even air pressure are trained deliberately.',
    points: [
      'Breathe from the diaphragm: the abdomen expands on the in-breath while the shoulders stay still.',
      'Inhale quickly and silently through the mouth; exhale slowly and evenly through a small lip opening.',
      'Evenness matters more than length. A note that keeps the same loudness and pitch from start to finish is the goal.',
    ],
    exercises: [
      { label: 'Counted breathing (without flute)', text: 'Inhale for 4 counts, hold for 4, exhale on a soft "sss" for 8. Extend the exhale to 12, then 16, over several weeks.' },
      { label: 'Long tones', phrase: 'S - - - - - - -, R - - - - - - -, G - - - - - - -', text: 'One swara per breath. Time each note and write it down. Aim to add a second each week.' },
      { label: 'Soft to loud to soft', text: 'On one breath, begin as softly as possible, swell to full volume, and fade to nothing without the pitch moving. Watch the tuner: loud notes tend to go sharp, soft ones flat.' },
    ],
    drill: 'sustain',
    tips: ['Stop before you feel dizzy. Short daily sessions build capacity faster than occasional long ones.'] },

  { id: 'sargam', level: 'Foundation', topic: 'Swara practice', title: 'The seven shuddha swaras', mins: 15,
    intro: 'On the bansuri, Sa is played with the top three holes closed. The natural scale of the instrument has tivra Ma; shuddha Ma is made by half-covering the top hole.',
    points: [
      'Sa: three holes closed. Re: two. Ga: one. Tivra Ma: all open. Pa: all six closed, blown into the second register. Dha: five closed. Ni: four closed.',
      'Mandra Pa, Dha and Ni use the same fingerings as the middle ones with slower, warmer air.',
      'Always practise with the tanpura. Each swara has one exact place where it stops "beating" against the drone.',
    ],
    exercises: [
      { label: 'Ascending and descending', phrase: "S R G m P D N S', S' N D P m G R S" },
      { label: 'Every note twice', phrase: "S S R R G G m m P P D D N N S' S'" },
      { label: 'From the lowest note', phrase: ".P .D .N S R G m P" },
    ],
    drill: 'sustain',
    tips: ['Check each swara in the Tuner. Build the intonation map of your flute so you know which notes need lipping up or down.'] },

  { id: 'sustain', level: 'Beginner', topic: 'Pitch stability', title: 'Holding a steady pitch', mins: 15,
    intro: 'A swara that wavers has no place to sit in a raag. Stability comes from constant air speed and a still embouchure.',
    points: [
      'Pitch on the bansuri follows air speed and lip coverage: faster air or rolling the flute outward raises it; slower air or rolling inward lowers it.',
      'The beginning and end of a note are the hardest: start without a "scoop" and finish without sagging.',
      'Use the drill below. Aim for ten unbroken seconds inside your tolerance on every note of the scale.',
    ],
    exercises: [
      { label: 'Kharaj-style long notes', phrase: 'S - - - - - - -, .N - - - - - - -, .D - - - - - - -, .P - - - - - - -', text: 'Low, quiet, long. This is the classical foundation of tone.' },
      { label: 'Attack and release', text: 'Play each swara eight times as short two-second notes. Each must begin exactly on pitch.' },
    ],
    drill: 'sustain', tips: ['Record a set of long tones in Practice. The "steadiness" figure is your wobble in cents; try to bring it under ±8.'] },

  { id: 'alankar-1', level: 'Beginner', topic: 'Alankars', title: 'Alankars I: stepwise patterns', mins: 20,
    intro: 'Alankars are melodic patterns moved step by step through the scale. They train the fingers, the ear and the breath together.',
    points: [
      'Learn each pattern slowly, then at double speed with the same clarity.',
      'Keep every note the same length and loudness. Unevenness reveals which finger movement is weak.',
      'Take breaths at the ends of groups, never in the middle of one.',
    ],
    exercises: [
      { label: 'Threes', phrase: "S R G, R G m, G m P, m P D, P D N, D N S', S' N D, N D P, D P m, P m G, m G R, G R S" },
      { label: 'Fours', phrase: "S R G m, R G m P, G m P D, m P D N, P D N S', S' N D P, N D P m, D P m G, P m G R, m G R S" },
    ],
    drill: 'palta', tips: ['Use the generator to practise the same patterns in the thaat of the raag you are learning.'] },

  { id: 'komal', level: 'Beginner', topic: 'Swara practice', title: 'Komal swaras and shuddha Ma: half-holing', mins: 15,
    intro: 'The bansuri has no keys. Komal Re, Ga, Dha, Ni and shuddha Ma are produced by partly uncovering a hole, which demands a trained ear.',
    points: [
      'From the swara below, slide or lift the finger so that roughly half of the next hole is open. The exact amount differs for each hole and each flute.',
      'Shuddha Ma: half-cover the top hole (or, on some flutes, cover it fully and vent below).',
      'Half-holed notes are naturally softer and duller. Support them with slightly faster air.',
      'Trust the drone, not the finger position.',
    ],
    exercises: [
      { label: 'Pairs', phrase: 'S r S, R g R, P d P, D n D, G m G', text: 'Move between a full note and its half-holed neighbour until the komal note lands in the same place every time.' },
      { label: 'Kafi scale', phrase: "S R g m P D n S', S' n D P m g R S" },
      { label: 'Bhairav scale', phrase: "S r G m P d N S', S' N d P m G r S" },
    ],
    drill: 'sustain', tips: ['In Settings, choose just intonation to see the classical target for each komal swara rather than the piano\'s.'] },

  { id: 'octaves', level: 'Beginner', topic: 'Octave transitions', title: 'Moving between the saptaks', mins: 15,
    intro: 'The second register uses the same fingerings with a faster, narrower air stream. The change must come from the lips, not from blowing harder.',
    points: [
      'To rise an octave, make the lip opening smaller and aim the air slightly higher. Blowing harder alone makes the note sharp and harsh.',
      'To descend, open and relax the lips; keep the air moving so the low note speaks immediately.',
      'Typical range: mandra Pa to taar Pa, about two and a half octaves.',
    ],
    exercises: [
      { label: 'Octave leaps', phrase: "S S' S, R R' R, G G' G, m m' m, P P' P" },
      { label: 'Across the break', phrase: "G m P D, D P m G, m P D N, N D P m" , text: 'The change of register falls between Ma and Pa. Make it inaudible.' },
      { label: 'Three registers', phrase: ".P .D .N S R G m P D N S' R' G' m' P'" },
    ],
    tips: ['Watch the tuner: if taar notes read sharp, you are over-blowing. Narrow the lips and use less air.'] },

  { id: 'tonguing', level: 'Beginner', topic: 'Articulation', title: 'Tonguing and finger articulation', mins: 12,
    intro: 'Notes are separated either with the tongue ("ta", "ka") or, more characteristically in Indian music, with tiny finger taps.',
    points: [
      'Single tonguing: a light "tu" at the start of each note. Keep the air flowing; the tongue only interrupts it.',
      'Double tonguing: alternate "tu-ku" for fast passages and jhala.',
      'Finger articulation: repeat a note by flicking the finger of the note above (a quick grace), leaving the breath continuous.',
    ],
    exercises: [
      { label: 'Repeated notes, tongued', phrase: "S S S S, R R R R, G G G G, m m m m, P P P P" },
      { label: 'Repeated notes, fingered', text: 'Play the same line on one unbroken breath, separating the notes only with a flick of the finger above.' },
    ],
    tips: ['In alap, prefer finger articulation; keep tonguing for rhythmic passages.'] },

  { id: 'alankar-2', level: 'Intermediate', topic: 'Palta exercises', title: 'Paltas in every thaat', mins: 25,
    intro: 'Once the patterns are fluent in shuddha swaras, move them through all ten thaats. This is where half-holing becomes automatic.',
    points: [
      'Choose one thaat per day. Play each pattern slowly once, then at dugun (double) and chaugun (four times).',
      'Skipping patterns ("S G, R m") expose intonation more than stepwise ones.',
    ],
    exercises: [
      { label: 'Skips', phrase: "S G, R m, G P, m D, P N, D S', S' D, N P, D m, P G, m R, G S" },
      { label: 'Zig-zag', phrase: "S G R m, R m G P, G P m D, m D P N, P N D S'" },
    ],
    drill: 'palta', tips: ['Record the hardest thaat and check "Intonation by swara": the komal notes show up immediately.'] },

  { id: 'meend', level: 'Intermediate', topic: 'Meend', title: 'Meend: the glide between swaras', mins: 20,
    intro: 'Meend is a continuous, vocal slide from one swara to another. On the bansuri it is made by gradually uncovering or covering holes, helped by the lips.',
    points: [
      'Slide the finger off the hole sideways (or roll it) rather than lifting it, so the pitch rises smoothly.',
      'For slides over more than one hole, move the fingers in overlapping sequence and keep the air perfectly even.',
      'Small bends of up to a semitone can be made by rolling the flute in or out.',
      'A meend has a destination. Arrive exactly on the target swara and rest there.',
    ],
    exercises: [
      { label: 'One-step glides', phrase: 'S - R - -, R - G - -, G - R - -, R - S - -', text: 'Take two full counts to travel between the notes.' },
      { label: 'Two- and three-step glides', phrase: 'S - G - -, G - S - -, P - G - -, G - P - -' },
      { label: 'Raag phrases', phrase: "P - R - -, .N R G - -, N D P - -", text: 'The P to R slide of Yaman and Chhayanat; the gentle descent of Yaman.' },
    ],
    tips: ['Record your meends. In the sequence view, notes reached by a detected glide are marked with a curved tie.'] },

  { id: 'kan', level: 'Intermediate', topic: 'Ornaments', title: 'Kan, murki and khatka', mins: 15,
    intro: 'Small ornaments give a line its Indian character. They are touches, not notes, and must never disturb the main swara.',
    points: [
      'Kan swar: a grace note, barely sounded, touching the main note from above or below.',
      'Murki: a quick, light cluster of three or four notes wrapped around a swara.',
      'Khatka: a sharper, more forceful turn.',
    ],
    exercises: [
      { label: 'Kan from above', text: 'Play S R G m P, touching each note first with a flick of the note above it.' },
      { label: 'Murki shapes', phrase: 'R S .N S, G R S R, m G R G, P m G m' , text: 'Slow at first, then compress into a single quick gesture landing on the last note.' },
    ],
    tips: ['If the ornament can be counted, it is too slow or too heavy.'] },

  { id: 'gamak', level: 'Intermediate', topic: 'Gamak', title: 'Gamak: weighted oscillation', mins: 15,
    intro: 'Gamak is a forceful, repeated shake between a swara and its neighbour, used in jod and fast taans.',
    points: [
      'Each note is approached from the note below (or above) with a strong push of breath from the diaphragm.',
      'The fingers move decisively; the breath pulses on every note.',
      'Keep the rhythm exact. Gamak is a rhythmic ornament.',
    ],
    exercises: [
      { label: 'From below', phrase: 'S R R, R G G, G m m, m P P, P D D', text: 'The first note of each pair is the launch; lean into the second.' },
      { label: 'Gamak scale', phrase: "S S R R G G m m P P D D N N S' S'", text: 'Each repeated note is re-struck from the note below with a breath pulse.' },
    ],
    tips: ['Practise with a metronome or tabla loop, increasing speed only when every pulse is even.'] },

  { id: 'vibrato', level: 'Intermediate', topic: 'Vibrato', title: 'Vibrato and andolan', mins: 15,
    intro: 'Indian classical music uses a still, straight tone by default. Oscillation is a deliberate choice: slow andolan in certain raags, a light breath vibrato in lighter music.',
    points: [
      'Breath vibrato: gentle pulses from the diaphragm, about five per second, a few cents wide.',
      'Andolan: a slow, wide swing (one to three per second) on particular swaras, such as komal Re and Dha in Bhairav or komal Ga and Dha in Darbari. Made with the finger and lips, approaching from the note above.',
      'First master a perfectly straight tone. Then add oscillation only where the raag asks for it.',
    ],
    exercises: [
      { label: 'Straight, then pulsed', text: 'Hold Pa for eight counts straight, then eight counts with four even pulses per count. Return to straight.' },
      { label: 'Bhairav andolan', phrase: 'G m r - - -, G m d - - -, d - - P', text: 'Let komal Re and komal Dha swing slowly and heavily before settling.' },
    ],
    drill: 'sustain', tips: ['Record and open the take: the app reports vibrato or andolan when it finds a regular oscillation on a held note.'] },

  { id: 'laya', level: 'Intermediate', topic: 'Rhythm', title: 'Laya: doubling the tempo', mins: 15,
    intro: 'Rhythmic control is practised by playing the same material at exact multiples of a steady pulse.',
    points: ['Ekgun: one note per beat. Dugun: two. Tigun: three. Chaugun: four.', 'Keep the foot or a metronome on the original beat while the notes multiply.'],
    exercises: [
      { label: 'Scale in four speeds', phrase: "S R G m P D N S', S' N D P m G R S", text: 'Play at ekgun, dugun, tigun and chaugun without pausing between speeds.' },
      { label: 'Teental cycle', text: 'Fit a 16-note palta exactly into one cycle of teental (16 beats), then two and four cycles\' worth of notes into one.' },
    ],
    tips: ['Set the tanpura tempo to a comfortable pulse and treat each pluck as a beat.'] },

  { id: 'alap', level: 'Advanced', topic: 'Raag development', title: 'Alap: unfolding a raag', mins: 30,
    intro: 'Alap is the unmetered exploration of a raag, note by note. It is the truest test of tone, intonation and understanding.',
    points: [
      'Begin around Sa and the mandra saptak. Establish Sa, then the notes just below it.',
      'Introduce one new swara at a time, always in the phrases the raag allows, returning to a resting note (nyas) after each idea.',
      'Give the vadi and samvadi weight. Reach taar Sa as a climax, then descend to close.',
      'Silence is part of the alap. Let each phrase finish before the next begins.',
    ],
    exercises: [
      { label: 'Yaman, first stage', phrase: "S - -, .N .D .N - -, .N R S - -, .N R G - -, R G, R S - -" },
      { label: 'Yaman, second stage', phrase: ".N R G M - -, G M D - -, M D N - -, D P - -, M G R - -, .N R S - -" },
      { label: 'Twenty-minute alap', text: 'Choose a raag from the library. Spend five minutes below Sa, five in the lower half, five in the upper half, five around taar Sa and the return.' },
    ],
    tips: ['Record the alap and run "Identify the raag" on it. If the raag you intended is not near the top, read the reasons given.'] },

  { id: 'taan', level: 'Advanced', topic: 'Taans', title: 'Taans: fast passages', mins: 25,
    intro: 'Taans are rapid melodic runs. Clarity and correctness of the raag at speed matter more than speed itself.',
    points: [
      'Sapat taan: straight runs up and down the raag\'s scale.',
      'Alankar taan: built from palta patterns. Chhoot taan: with leaps. Gamak taan: every note shaken.',
      'Plan the breath. End every taan on a clear nyas, usually Sa or the vadi.',
    ],
    exercises: [
      { label: 'Sapat (Yaman)', phrase: ".N R G M D N S' N D P M G R S" },
      { label: 'Alankar taan', phrase: ".N R G R, G M G M, D N D N, S' N D P, M G R S" },
      { label: 'Tihai ending', phrase: "G M D N S' -, G M D N S' -, G M D N S'", text: 'A phrase played three times to land on the first beat.' },
    ],
    drill: 'palta', tips: ['Use Practice to check that fast notes are still being detected as distinct swaras; smeared runs show as glides.'] },

  { id: 'jod-jhala', level: 'Advanced', topic: 'Articulation', title: 'Jod and jhala on the bansuri', mins: 20,
    intro: 'After alap, jod adds a pulse and jhala builds rhythmic excitement. On the flute both rely on precise tonguing.',
    points: [
      'Jod: steady medium pulse, phrases of the raag articulated with soft single tonguing and gamak.',
      'Jhala: melody notes alternating with rapid repeated Sa (or Pa), using double and triple tonguing: "ta-ka", "ta-ka-ta".',
    ],
    exercises: [
      { label: 'Jhala pattern', phrase: "G S' S' S', R S' S' S', G S' S' S', M S' S' S'", text: 'Accent the melody note; keep the taar Sa strokes light and even.' },
      { label: 'Triple tonguing', text: 'On one note: ta-ka-ta, ta-ka-ta, at a steady pulse, for a full breath.' },
    ],
    tips: [] },

  { id: 'raag-path', level: 'Advanced', topic: 'Raag-based exercises', title: 'A path through the raags', mins: 10,
    intro: 'Raags are learnt in an order that introduces one difficulty at a time. Each raag page in the library has its own beginner, intermediate and advanced practice.',
    points: [
      'Begin with raags that suit the flute\'s natural scale and need little half-holing.',
      'Then add shuddha Ma and one komal swara at a time.',
      'Leave the heavily ornamented and vakra raags until meend and andolan are secure.',
    ],
    raags: [
      { h: 'Start here', ids: ['bhupali', 'yaman', 'durga', 'hansadhwani', 'brindavani-sarang'] },
      { h: 'Next', ids: ['bhimpalasi', 'kafi', 'khamaj', 'desh', 'bageshree', 'malkauns', 'bihag'] },
      { h: 'Then', ids: ['bhairav', 'ahir-bhairav', 'bhairavi', 'jaunpuri', 'puriya-dhanashree', 'kedar', 'shivranjani'] },
      { h: 'Advanced', ids: ['todi', 'marwa', 'darbari', 'miyan-malhar', 'lalit', 'shree', 'gaud-sarang'] },
    ],
    exercises: [], tips: [] },

  { id: 'shruti', level: 'Professional', topic: 'Intonation', title: 'Shruti: refining intonation', mins: 20,
    intro: 'The same komal Re is not the same pitch in every raag. Professional intonation means placing each swara where the raag wants it against the drone.',
    points: [
      'Just intonation gives the pure reference: Ga 14 cents below the piano\'s, komal Ga 16 above, Dha 16 below, and so on. Select it in Settings to measure against these targets.',
      'Some raags lower their komal swaras further: komal Re and Ga in Todi, komal Ga in Darbari, komal Re in Marwa are traditionally taken very low. Others, like komal Re in Bhairav, oscillate around the pitch.',
      'A bamboo flute is never perfectly in tune with itself. Use the Tuner\'s intonation map to learn each note\'s tendency, then correct with lips and air.',
      'Temperature matters: a cold flute is flat. Warm the instrument before judging it.',
    ],
    exercises: [
      { label: 'Consonances with the drone', phrase: 'S - - -, P - - -, S - - -, m - - -, S - - -, G - - -', text: 'Hold each note until all beating against the tanpura disappears.' },
      { label: 'Low komal swaras', phrase: 'S r - - S, r g - - r S', text: 'Play komal Re and Ga as in Todi: as low as they will go while still sounding like themselves.' },
    ],
    drill: 'sustain', tips: ['The app measures against the temperament you choose; it does not know raag-specific shruti. Use your ear and your teacher for those.'] },

  { id: 'riyaz', level: 'Professional', topic: 'Practice routine', title: 'A daily riyaz plan', mins: 10,
    intro: 'Consistency beats duration. A balanced session touches tone, technique and music every day.',
    points: [
      '10 minutes: long tones in the mandra saptak with the tanpura.',
      '15 minutes: paltas in the thaat of the day\'s raag, in three speeds.',
      '10 minutes: one technique (meend, gamak, tonguing or octave leaps).',
      '20 minutes: alap and composition in the raag.',
      '5 minutes: record a short take and review its analysis.',
    ],
    exercises: [{ label: 'Weekly review', text: 'Keep one recording per week of the same alap. Compare the in-tune percentage and steadiness figures from week to week.' }],
    tips: ['Morning practice of long low notes (kharaj) is traditional because the mind and the room are quiet.'] },
];

export const PATTERNS = [
  { name: 'Threes', p: [0, 1, 2] }, { name: 'Fours', p: [0, 1, 2, 3] }, { name: 'Skips', p: [0, 2] },
  { name: 'Turn', p: [0, 1, 2, 1] }, { name: 'Zig-zag', p: [0, 2, 1, 3] }, { name: 'Double step', p: [0, 1, 0, 1, 2] }, { name: 'Return', p: [0, 2, 1, 0] },
];
