const findDateAlternatives = (dateString: string) => {
  // supported date formats:
  // 2021-12-31
  // 31-12-2021
  // 31/12/2021
  // 12/31/2021
  // 31 Dec 2021
  // 31 December 2021
  // 31 Dec
  // 31 December

  // first we need to identify the input format out of the supported formats
  let year = null;
  let month = null;
  let day = null;
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    year = dateString.substring(0, 4);
    month = dateString.substring(5, 7);
    day = dateString.substring(8, 10);
  } else if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
    year = dateString.substring(6, 10);
    month = dateString.substring(3, 5);
    day = dateString.substring(0, 2);
  } else if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    year = dateString.substring(6, 10);
    month = dateString.substring(3, 5);
    day = dateString.substring(0, 2);
  } else {
    let pattern = /(\d{1,2})\s(\w{3,9})\s(\d{4})/;
    let match = dateString.match(pattern);
    if (match) {
      day = match[1];
      month = monthTextToNumber(match[2].toLowerCase());
      year = match[3];
    } else {
      let pattern = /(\d{1,2})\s(\w{3,9})/;
      let match = dateString.match(pattern);
      if (match) {
        day = match[1];
        month = monthTextToNumber(match[2].toLowerCase());
      }
    }
  }
  if (!day || !month) {
    return { dates: [dateString], date: false };
  }
  // check if month is greater than 12
  if (parseInt(month) > 12) {
    let temp = month;
    month = day;
    day = temp;
  }
  let alternatives = [dateString];
  let monthFull = monthsFull[parseInt(month) - 1];
  let monthShort = months[parseInt(month) - 1];
  if (year) {
    alternatives.push(`${year}-${month}-${day}`);
    alternatives.push(`${day}-${month}-${year}`);
    alternatives.push(`${day}/${month}/${year}`);
    alternatives.push(`${month}/${day}/${year}`);
    alternatives.push(`${day} ${monthShort} ${year}`);
    alternatives.push(`${day} ${monthFull} ${year}`);
  } else {
    alternatives.push(`${day} ${monthShort}`);
    alternatives.push(`${day} ${monthFull}`);
  }
  return { dates: alternatives, date: true };
};

const findNumberAlternatives = (numberText: string) => {
  // check if the input contains only digits, dots, commas, $ or €
  if (!numberText.match(/^[\d.,€$]+$/)) {
    return { numbers: [numberText], number: false };
  }
  // support all of the following formats:
  // 1,000,000
  // 1,000,000.00
  // 1000000
  // 1000000.00
  // $1,000,000
  // $1,000,000.00
  // $1000000
  // $1000000.00
  // €1,000,000
  // €1,000,000.00
  // €1000000
  // €1000000.00
  // clean the input from $ and €
  let number = numberText.replace(/[$€]/g, "").trim();
  // extract the decimal part
  let decimal = null;
  let parts = number.split("[.,]");
  // check if the last part length is 1 or 2
  if (parts.length > 1 && (parts[parts.length - 1].length === 1 || parts[parts.length - 1].length === 2)) {
    decimal = parts.pop();
  }
  // check that all the parts that are not the first as 3 digits
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].length !== 3) {
      return { numbers: [numberText], number: false };
    }
  }
  // remove all commas and dots
  number = parts.join("");
  const alternatives = [numberText];
  alternatives.push(number);
  if (decimal) {
    alternatives.push(`${number}.${decimal}`);
  }
  // enter , every 3 digits from the right so 1000000 becomes 1,000,000
  let formattedComma = "";
  let formattedDot = "";
  let counter = 0;
  for (let i = number.length - 1; i >= 0; i--) {
    if (counter === 3) {
      formattedComma = "," + formattedComma;
      formattedDot = "." + formattedDot;
      counter = 0;
    }
    formattedComma = number[i] + formattedComma;
    formattedDot = number[i] + formattedDot;
    counter++;
  }
  alternatives.push(formattedComma);
  alternatives.push(formattedDot);
  if (decimal) {
    alternatives.push(`${formattedComma}.${decimal}`);
    alternatives.push(`${formattedDot},${decimal}`);
  }
  return { numbers: alternatives, number: true };
};
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthsFull = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const monthTextToNumber = (monthText: string) => {
  let monthIndex = months.indexOf(monthText);
  if (monthIndex === -1) {
    monthIndex = monthsFull.indexOf(monthText);
  }
  if (monthIndex !== -1) {
    return (monthIndex + 1).toString();
  }
  return null;
};
export { findDateAlternatives, findNumberAlternatives };
