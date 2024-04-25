import dayjs from "dayjs"
import { Locator } from "playwright"

const getDateTimeSegments = async (input: {
  element: Locator
  value: string
  // locale: string
}) => {
  const type = await input.element.getAttribute("type")
  const parsedValue = dayjs(input.value)
  switch (type) {
    case "date":
      return [parsedValue.format("DD"), parsedValue.format("MM"), parsedValue.format("YYYY")]
    case "time":
      return [parsedValue.format("HH"), parsedValue.format("mm")]
    case "datetime-local":
      return [parsedValue.format("DD"), parsedValue.format("MM"), parsedValue.format("YYYY"), parsedValue.format("HH"), parsedValue.format("mm")]
    case "month":
      return [parsedValue.format("MM"), parsedValue.format("YYYY")]
    case "week":
      return [parsedValue.format("WW"), parsedValue.format("YYYY")]
    default:
      return [parsedValue.format("DD/MM/YYYY")]
  }
}

export { getDateTimeSegments}