import dayjs from "dayjs";
import { Locator } from "playwright";

const getDateTimeSegments = async (input: {
  element: Locator;
  value: string;
  // locale: string
}) => {
  const type = await input.element.getAttribute("type");
  const parsedValue = dayjs(input.value);
  switch (type) {
    case "date":
      return [parsedValue.format("DD"), parsedValue.format("MM"), parsedValue.format("YYYY")];
    case "time":
      return [parsedValue.format("HH"), parsedValue.format("mm")];
    case "datetime-local":
      return [
        parsedValue.format("DD"),
        parsedValue.format("MM"),
        parsedValue.format("YYYY"),
        parsedValue.format("HH"),
        parsedValue.format("mm"),
      ];
    case "month":
      return [parsedValue.format("MM"), parsedValue.format("YYYY")];
    case "week":
      return [parsedValue.format("WW"), parsedValue.format("YYYY")];
    default:
      return [parsedValue.format("DD/MM/YYYY")];
  }
};

const getDateTimeValue = async (input: { element: Locator; value: string }) => {
  const type = await input.element.getAttribute("type");
  const parsedValue = dayjs(input.value);
  switch (type) {
    case "date":
      return parsedValue.format("YYYY-MM-DD");
    case "time":
      return parsedValue.format("HH:mm");
    case "datetime-local":
      return parsedValue.format("YYYY-MM-DD[T]HH:mm");
    case "month":
      return parsedValue.format("YYYY-MM");
    case "week":
      return parsedValue.format("YYYY-[W]WW");
    default:
      return parsedValue.format("YYYY-MM-DD[T]HH:mm");
  }
};

export { getDateTimeSegments, getDateTimeValue };
