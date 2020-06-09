// Set up Art-Net to communicate with bloclock
let artnet = require('artnet');
let lamp = artnet({
  host: '192.168.2.5',
});

let Calendar = require('./Calendar.js')
let calendar = new Calendar();

// LED Grid Settings
let ledWidth = 15;
let ledHeight = 9;
let amountOfLeds = ledWidth * ledHeight;
let channels = amountOfLeds * 3;
let FPS = 40;
let LEDS = Array(amountOfLeds).fill({ r: 0, g: 0, b: 0 });

// Active state
const TWENTYFOURHOUR_MODE = 1;
const BLOCLOCK_MODE = 2;
const NIGHT_MODE = 3;
let STATE = NIGHT_MODE;

// Bed time setting
let bedtimeHour = 23;
let bedtimeMinute = 0;


const colors = {
  off: { r: 0, g: 0, b: 0 },
  currentDot: { r: 255, g: 10, b: 150 },
  currentDotNight: { r: 100, g: 1, b: 1 },
  sleepDot: { r: 0, g: 0, b: 2 },
  sleepDotNight: { r: 0, g: 0, b: 2 },
};
const CALENDAR_CHECK_INTERVAL = 10000;

/**
 * Shows a 24H overview of time with highlighting the sleep time
 */
function twentyFourHourMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes) {
  let minutesInADay = 24 * 60;
  let minutesPerLed = minutesInADay / amountOfLeds;

  let currentLed = Math.ceil(timeInMinutes / minutesPerLed) % amountOfLeds;
  let bedtimeLed = Math.ceil(bedtimeInMinutes / minutesPerLed) % amountOfLeds;
  let awaketimeLed = Math.ceil(awaketimeInMinutes / minutesPerLed) % amountOfLeds;

  let isNight = true;
  if (timeInMinutes - bedtimeInMinutes > 0) {
    isNight = true;
  }

  LEDS.forEach((led, i) => {
    LEDS[i] = colors.off;

    if (i === currentLed % amountOfLeds) {
      if (isNight) {
        LEDS[i] = colors.currentDotNight;
      } else {
        LEDS[i] = colors.currentDot;
      }
    } else if (i === bedtimeLed || i === awaketimeLed) {
      LEDS[i] = colors.sleepDotNight;
    } else if (!isNight && (i >= bedtimeLed || i <= awaketimeLed)) {
      // Turn LED off if human is sleeping & the dot has already passed
      if (
        (currentLed < awaketimeLed && (i < currentLed || i >= bedtimeLed)) ||
        (currentLed > bedtimeLed && i < currentLed && i >= bedtimeLed)
      ) {
        LEDS[i] = colors.off;
      } else {
        LEDS[i] = colors.sleepDot;
      }
    }
  });
}

/**
 * Night mode
 */
function nightMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes, frame) {
  let minutesPerLed = 8*60 / ledWidth
  let currentLed = Math.floor((timeInMinutes-bedtimeInMinutes) / minutesPerLed) % ledWidth
  
    LEDS.forEach((led, i) => {
        let row = 4;
        // If is selected row
        if (i >= row * ledWidth && i < (row+1) * ledWidth) {
            if(i%ledWidth=== currentLed){
                LEDS[i] = colors.sleepDotNight;
            }else if (i%ledWidth < currentLed){
                LEDS[i] = colors.sleepDotNight;
            }else{
                LEDS[i] = colors.sleepDot;
            }
        } 
    });
}

/**
 * Shows the time you have left before you have to go to bed.
 */
let lastCalendarCheck = 0;
async function bloclockMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes, frame) {
  let awakeMinutesInADay = (24 - 8) * 60;
  let minutesPerLed = awakeMinutesInADay / amountOfLeds;

  let currentLed = Math.floor(timeInMinutes / minutesPerLed) % amountOfLeds;

  // Get calender items for today every x seconds
  let now = new Date();
  if(now-lastCalendarCheck > CALENDAR_CHECK_INTERVAL){
      lastCalendarCheck = now;
      let events = await calendar.listEvents();
        for (let event of events) {
            
          const start = event.start.dateTime || event.start.date;
             console.log(`${start} - ${event.summary}`);
        }
  }

  // Draw blocks
  let blocksOver = 0;
  LEDS.forEach((led, i) => {
    let blockTime = Math.floor(awaketimeInMinutes + minutesPerLed * i);

    let isOver = timeInMinutes > blockTime + minutesPerLed;
    let isOn = timeInMinutes <= blockTime + minutesPerLed && timeInMinutes > blockTime;

    if (isOver) {
      LEDS[i] = { r: 0, g: 3, b: 1 };
    } else if (isOn) {
      let fade = (Math.sin(frame / 20) + 1)/2;
      LEDS[i] = fadeColor(colors.currentDot, fade);
    } else {
      LEDS[i] = { r: 00, g: 30, b: 100 };
    }
  });

}

function bloclockModeComplex(){

}


let frame = 0;

function loop() {
  LEDS.fill(colors.off);
  let reversefade = Math.round(((Math.sin(Math.PI + frame / 40) + 1) / 2) * 30);

  let minutesInADay = 24 * 60;
  let bedtimeInMinutes = (bedtimeHour * 60 + bedtimeMinute) % minutesInADay;
  let awaketimeInMinutes = (bedtimeInMinutes + 8 * 60) % minutesInADay;

  let now = new Date();
  let timeInMinutes = 23*60 + 33;
  // let timeInMinutes = now.getHours() * 60 + now.getMinutes() + 4*60

  switch (STATE) {
    case TWENTYFOURHOUR_MODE:
      twentyFourHourMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes);
      break;
    case BLOCLOCK_MODE:
      bloclockMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes, frame);
      break;
    case NIGHT_MODE:
        nightMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes, frame);
        break;
  }

  //   let fade = (Math.sin(frame / 19) + 1) / 2;
  //   let fadeScale = Math.round(fade * 20);
  // let movingLed = frame % amountOfLeds;
  // let movingLed2 = (frame + 40) % amountOfLeds;
  // if (i === movingLed) {
  //   LEDS[i] = { r: 200, g: 0, b: 100 };
  // }
  // if (i === movingLed2) {
  //   LEDS[i] = { r: 0, g: 0, b: 200 };
  // }

  // let movingLed = frame % amountOfLeds;
  // LEDS[movingLed] = { r: 200, g: 0, b: 100 };
  // LEDS[4] = {r:0,g:0,b:0};

  //LEDS.fill({ r: reversefade / 4, g: 0, b: reversefade });
  // /  console.log(currentLed,bedtimeLed,awaketimeLed, LEDS.length);

  // nightMode();

  updateMatrix(LEDS);
  frame += 1;

  //console.log(LEDS);
}

/**
 * Convert the LED rgb array into an array and send it through artnet;
 * @param {} leds
 */
function updateMatrix(leds) {
  let ledBinary = Array(channels);

  // Reverse bc display is turned upside down oops
  //leds = leds.slice().reverse();

  for (let y = 0; y < ledHeight; y++) {
    for (let x = 0; x < ledWidth; x++) {
      // Change up the array to account for serpentine layout of the LED strip
      let i = y * ledWidth + x;
      let j = getLedAtPosition(x, y);

      ledBinary[j * 3] = leds[i].r;
      ledBinary[j * 3 + 1] = leds[i].g;
      ledBinary[j * 3 + 2] = leds[i].b;
    }
  }

  // lamp.set(15, 1, [255]); // brightness
  lamp.set(0, 1, ledBinary);
}

setInterval(loop, 1000 / FPS);

function getLedAtPosition(x, y) {
  let i = y * ledWidth + x;
  return xyTable[i];
}

//From https://macetech.github.io/FastLED-XY-Map-Generator/
let xyTable = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  29,
  28,
  27,
  26,
  25,
  24,
  23,
  22,
  21,
  20,
  19,
  18,
  17,
  16,
  15,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  59,
  58,
  57,
  56,
  55,
  54,
  53,
  52,
  51,
  50,
  49,
  48,
  47,
  46,
  45,
  60,
  61,
  62,
  63,
  64,
  65,
  66,
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  89,
  88,
  87,
  86,
  85,
  84,
  83,
  82,
  81,
  80,
  79,
  78,
  77,
  76,
  75,
  90,
  91,
  92,
  93,
  94,
  95,
  96,
  97,
  98,
  99,
  100,
  101,
  102,
  103,
  104,
  119,
  118,
  117,
  116,
  115,
  114,
  113,
  112,
  111,
  110,
  109,
  108,
  107,
  106,
  105,
  120,
  121,
  122,
  123,
  124,
  125,
  126,
  127,
  128,
  129,
  130,
  131,
  132,
  133,
  134,
];

/**
 * Fade a color by an amount of 0-1
 */
function fadeColor({r,g,b}, fade) {

    let faded = {
      r: r * fade * (r/ 255),
      g: g * fade * (g/255),
      b: b * fade * (b/ 255),
    };

    return faded;
    
}