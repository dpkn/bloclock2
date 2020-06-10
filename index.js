// Set up Art-Net to communicate with bloclock
let artnet = require('artnet');
let lamp = artnet({
  host: '192.168.2.5',
});

let Calendar = require('./Calendar.js');
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
let STATE = 2;

// Bed time setting
let bedtimeHour = 23;
let bedtimeMinute = 0;

const colors = {
  off: { r: 0, g: 0, b: 0 },
  currentDot: { r: 255, g: 10, b: 150 },
  currentDotNight: { r: 100, g: 1, b: 1 },
  sleepDot: { r: 0, g: 1, b: 1 },
  sleepDotNight: { r: 1, g: 0, b: 1 },
  eventDot: { r: 100, g: 200, b: 0 },
  normalDot: { r: 00, g: 30, b: 100 },
};
const CALENDAR_CHECK_INTERVAL = 10000;
let events = [];

/**
 * Shows a 24H overview of time with highlighting the sleep time
 */
function twentyFourHourMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes) {
  let minutesInADay = 24 * 60;
  let minutesPerLed = minutesInADay / amountOfLeds;

  let currentLed = Math.ceil(timeInMinutes / minutesPerLed) % amountOfLeds;
  let bedtimeLed = Math.ceil(bedtimeInMinutes / minutesPerLed) % amountOfLeds;
  let awaketimeLed = Math.ceil(awaketimeInMinutes / minutesPerLed) % amountOfLeds;

  let isNight = false;
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
  let minutesPerLed = (8 * 60) / ledWidth;
  let currentLed = Math.floor((timeInMinutes - bedtimeInMinutes) / minutesPerLed) % ledWidth;

  LEDS.forEach((led, i) => {
    let row = 4;
    // If is selected row
    if (i >= row * ledWidth && i < (row + 1) * ledWidth) {
      if (i % ledWidth === currentLed) {
        //LEDS[i] = { r: 1, g:1,b:1};

        // Breathing formula from https://sean.voisen.org/blog/2011/10/breathing-led-with-arduino/
        let fade = ((Math.exp(Math.sin((frame / 120.0) * Math.PI)) - 0.36787944) * 108.0) / 255;

        //let fade = (Math.sin(frame / 20) + 1) / 2;
        LEDS[i] = { r: 5 + 55 * fade, g: 0, b: 10 + 180 * fade };
      } else if (i % ledWidth < currentLed) {
        LEDS[i] = colors.sleepDotNight;
      } else {
        LEDS[i] = colors.sleepDot;
      }
    }
  });
}

/**
 * Shows the time you have left before you have to go to bed.
 */
function bloclockMode(timeInMinutes, awaketimeInMinutes, bedtimeInMinutes, frame) {
  let awakeMinutesInADay = (24 - 8) * 60;
  let minutesPerLed = awakeMinutesInADay / amountOfLeds;

  let currentLed = Math.floor(timeInMinutes / minutesPerLed) % amountOfLeds;

  // Draw blocks
  let blocksOver = 0;
  LEDS.forEach((led, i) => {
    let blockTime = Math.floor(awaketimeInMinutes + minutesPerLed * i);

    let isOver = timeInMinutes > blockTime + minutesPerLed;
    let isOn = timeInMinutes <= blockTime + minutesPerLed && timeInMinutes > blockTime;

    if (isOver) {
      LEDS[i] = { r: 1, g: 0, b: 1 };
    } else if (isOn) {
      let fade = (Math.sin(frame / 20) + 1) / 2;
      LEDS[i] = fadeColor(colors.currentDot, fade);
    } else {
      LEDS[i] = colors.normalDot;
    }

    for (let event of events) {
      const startDate = new Date(event.start.dateTime || event.start.date);
      const endDate = new Date(event.end.dateTime || event.end.date);
      let startDateInMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      let endDateInMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      
      let isOn = startDateInMinutes <= blockTime + minutesPerLed && startDateInMinutes > blockTime;
      if (isOn) {
        LEDS[i] = colors.eventDot;
      }
    }

  });
}

let frame = 0;

function loop() {
  LEDS.fill(colors.off);
  let reversefade = Math.round(((Math.sin(Math.PI + frame / 40) + 1) / 2) * 30);

  let minutesInADay = 24 * 60;
  let bedtimeInMinutes = (bedtimeHour * 60 + bedtimeMinute) % minutesInADay;
  let awaketimeInMinutes = (bedtimeInMinutes + 8 * 60) % minutesInADay;

  let now = new Date();
  //let timeInMinutes = 23*60 + 33;
  let timeInMinutes = now.getHours() * 60 + now.getMinutes();

  if (STATE === BLOCLOCK_MODE && timeInMinutes - bedtimeInMinutes >= 5) {
    STATE = NIGHT_MODE;
  }

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

  updateMatrix(LEDS);
  frame += 1;
}

setInterval(loop, 1000 / FPS);
setInterval(calendarCheck, CALENDAR_CHECK_INTERVAL);
async function calendarCheck() {
 // events = await calendar.listEvents();
 
  console.log(events);
}
// Really ugly way of waiting for authentication to finish bc im too tired for more async callback stuff
setTimeout(calendarCheck, 1000);

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

      ledBinary[j * 3] = Math.round(leds[i].r);
      ledBinary[j * 3 + 1] = Math.round(leds[i].g);
      ledBinary[j * 3 + 2] = Math.round(leds[i].b);
    }
  }

  // lamp.set(15, 1, [255]); // brightness
  lamp.set(0, 1, ledBinary);
}

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
function fadeColor({ r, g, b }, fade) {
  let faded = {
    r: Math.floor(r * fade * (r / 255)),
    g: Math.floor(g * fade * (g / 255)),
    b: Math.floor(b * fade * (b / 255)),
  };

  return faded;
}
