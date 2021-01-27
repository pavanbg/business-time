const database = require('./database');

const holidays = [];
const fullWorkingHours = 9;
const oneDayMilliSecs = 24 * 60 * 60 * 1000;
const workingHourCalender = {
  0: ['00:00:00-00:00:00'],
  1: ['09:00:00-18:00:00'], // ['09:00:00-13:00:00', '14:00:00-18:00:00']
  2: ['09:00:00-18:00:00'],
  3: ['09:00:00-18:00:00'],
  4: ['09:00:00-18:00:00'],
  5: ['09:00:00-18:00:00'],
  6: ['09:00:00-13:00:00'],
};

const normalHourCalender = {
  0: ['00:00:00-00:00:00'],
  1: ['00:00:00-24:00:00'],
  2: ['00:00:00-24:00:00'],
  3: ['00:00:00-24:00:00'],
  4: ['00:00:00-24:00:00'],
  5: ['00:00:00-24:00:00'],
  6: ['00:00:00-13:00:00'],
};

const timeType = {
  skip: 'skip',
  work: 'work',
};

function formatDate(inputDate, symbal) {
  const date = new Date(inputDate);
  let dd = date.getDate();
  let mm = date.getMonth() + 1;
  const yyyy = date.getFullYear();
  if (dd < 10) {
    dd = `0${dd}`;
  }
  if (mm < 10) {
    mm = `0${mm}`;
  }
  return `${yyyy}${symbal}${mm}${symbal}${dd}`;
}

function isHoliday(date) {
  if (holidays.includes(date)) {
    return true;
  }
  return false;
}

function getHolidays() {
  const query = `SELECT * FROM ${database.table.HOLIDAYS}`;
  database.executeCommand(query, database.scheme.CRIMEERP, (result) => {
    if (Array.isArray(result) && result.length > 0) {
      for (let i = 0; i < result.length; i += 1) {
        const date = formatDate(result[i].date, '-');
        if (!holidays.includes(date)) {
          holidays.push(date);
        }
      }
    } else {
      setTimeout(() => {
        getHolidays();
      }, 2000);
    }
  });
}
exports.getHolidays = getHolidays;

function getNextTransitionTime(inputDate, tat) {
  const dateObj = new Date(inputDate);
  const date = formatDate(dateObj, '-');
  const dateMilliSec = new Date(`${date} 00:00:00`).getTime();
  const day = dateObj.getDay();
  if (isHoliday(date)) {
    return [timeType.skip, oneDayMilliSecs - (inputDate - dateMilliSec)];
  }
  const timeMap = tat > fullWorkingHours ? normalHourCalender[day] : workingHourCalender[day];
  if (!timeMap || (Array.isArray(timeMap) && timeMap.length === 0)) {
    return [timeType.skip, (oneDayMilliSecs - (inputDate - dateMilliSec))];
  }
  for (let i = 0; i < timeMap.length; i += 1) {
    const [start, end] = timeMap[i].split('-');
    const startDate = new Date(`${date} ${start}`).getTime();
    const endDate = new Date(`${date} ${end}`).getTime();
    if (startDate > inputDate) {
      return [timeType.skip, (startDate - inputDate)];
    }
    if (startDate <= inputDate && endDate > inputDate) {
      return [timeType.work, (endDate - inputDate)];
    }
  }
  return [timeType.skip, (oneDayMilliSecs - (inputDate - dateMilliSec))];
}

function getTimeInMilliSecs(value = 0, unitParam = 'h') {
  const unit = unitParam.toLowerCase();
  if (unit === 's' || unit === 'seconds') {
    return value * 1000;
  } if (unit === 'm' || unit === 'mimutes') {
    return value * 60 * 1000;
  } if (unit === 'h' || unit === 'hours') {
    return value * 60 * 60 * 1000;
  }
  return value * 60 * 60 * 1000;
}

function milliSecsToHours(tatMilliSec) {
  return Math.round(tatMilliSec / (1000 * 60 * 60));
}

exports.getTatEndTime = (requestTime, clientTat, unit) => {
  let tatMilliSec = getTimeInMilliSecs(clientTat, unit);
  const tatInHours = milliSecsToHours(tatMilliSec);
  const requestStartTimeMilliSec = new Date(requestTime).getTime();
  let tatEndTime = requestStartTimeMilliSec;
  if (!new Date(requestTime).getTime()) {
    return 'invalid date';
  }
  while (tatMilliSec > 0) {
    const [type, time] = getNextTransitionTime(tatEndTime, tatInHours);
    if (type === timeType.skip) {
      tatEndTime += time;
    } else if (time > tatMilliSec) {
      tatEndTime += tatMilliSec;
      tatMilliSec = 0;
    } else {
      tatEndTime += time;
      tatMilliSec -= time;
    }
  }
  return new Date(tatEndTime);
};

setTimeout(() => {
  getHolidays();
}, 2000);
